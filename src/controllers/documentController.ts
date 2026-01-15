
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import prisma from '../prisma/client';
import { CommitteeName } from '@prisma/client';
import { stampPdf } from '../utils/pdfStamper';
import { UTApi } from 'uploadthing/server';

const utapi = new UTApi();

const CommitteeCodeMap: Record<CommitteeName, string> = {
  MEDIA: 'MED',
  SOCIAL_MEDIA: 'SMD',
  THORANA: 'THR',
  EVENT_MANAGEMENT: 'EMG',
  ACCOMMODATION: 'ACM',
  DIGITAL: 'DGT',
  INAUGURAL: 'ING',
  CREW: 'CRW',
  HOUSE_KEEPING: 'HKP',
  FOOD: 'FDC',
  TRANSPORT: 'TNP',
  PUBLICITY: 'PBC',
  DOCUMENTATION: 'DOC',
  FINANCE: 'FNC',
  CULTURAL: 'CTL',
  REQUIREMENTS: 'RQM',
  DISCIPLINARY: 'DCN',
  TECHNICAL: 'TCN',
  JURY: 'JRY',
};

export const createDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { title, description, committee, requestedBy, isClassified: isClassifiedStr, sharedCommittees: sharedCommitteesStr } = req.body;
        const file = req.file;
        const userId = req.user?.id;
        
        const isClassified = isClassifiedStr === 'true';
        let sharedCommittees: { name: string, access: 'HEAD_ONLY' | 'HEAD_AND_COHEAD' }[] = [];
        if (sharedCommitteesStr) {
            try {
                // Parse the new structure: array of objects { name: string, access: AccessType }
                const parsed = JSON.parse(sharedCommitteesStr);
                if (Array.isArray(parsed)) {
                    sharedCommittees = parsed;
                }
            } catch (e) {
                // ignore
            }
        }

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        // Check if user is Document Committee Member/Head
        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = (docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId);
        const userRole = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isMember && !isHead && !userRole) {
            return res.status(403).json({ message: 'Forbidden: Only Documentation team can create documents' });
        }

        let committeeCode = CommitteeCodeMap[committee as CommitteeName];
        if (isClassified) {
            committeeCode = 'CLS';
        }
        
        if (!committeeCode && !isClassified) return res.status(400).json({ message: 'Invalid committee' });

        const targetCommittee = await prisma.committee.findUnique({ where: { name: committee } });
        if (!targetCommittee) return res.status(400).json({ message: 'Target committee not found' });

        const docCount = await prisma.documentDetails.count({
            where: { committeeId: targetCommittee.id }
        });
        const bbb = (docCount + 1).toString().padStart(3, '0');

        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const cc = '01'; 

        const documentCode = `${committeeCode}${bbb}${dateStr}${cc}`;

        // Stamp the PDF
        const { buffer: stampedBuffer, pageCount } = await stampPdf(file.buffer, documentCode);

        // Upload to UploadThing
        const uploadResponse = await utapi.uploadFiles([
            new File([stampedBuffer as any], file.originalname, { type: 'application/pdf' })
        ]);

        if (uploadResponse[0].error) {
            console.error(uploadResponse[0].error);
             return res.status(500).json({ message: 'Failed to upload stamped file' });
        }

        const uploadedUrl = uploadResponse[0].data.ufsUrl;

        // Fetch shared committee IDs
        const sharedCommitteeNames = sharedCommittees.map(sc => sc.name);
        const sharedCommitteeRecords = await prisma.committee.findMany({
            where: { name: { in: sharedCommitteeNames as CommitteeName[] } }
        });

        const result = await prisma.$transaction(async (tx) => {
            const docDetails = await tx.documentDetails.create({
                data: {
                    title,
                    description,
                    committeeId: targetCommittee.id,
                    requestedBy,
                    isClassified,
                }
            });

            // Create DocumentAccess records
            if (isClassified && sharedCommittees.length > 0) {
                for (const sc of sharedCommittees) {
                    const com = sharedCommitteeRecords.find(c => c.name === sc.name);
                    if (com) {
                        await tx.documentAccess.create({
                            data: {
                                documentId: docDetails.id,
                                committeeId: com.id,
                                accessType: sc.access 
                            }
                        });
                    }
                }
            }

            const doc = await tx.document.create({
                data: {
                    documentCode,
                    fileUrl: uploadedUrl,
                    docDetailsId: docDetails.id,
                    generatedById: userId,
                    version: 1,
                    pageCount,
                }
            });
            return { docDetails, doc };
        });

        return res.json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const addRevision = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { docDetailsId } = req.body;
        const file = req.file;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        // Auth Check
        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = (docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId);
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isMember && !isHead && !isAdmin) {
             return res.status(403).json({ message: 'Forbidden' });
        }

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(docDetailsId) },
            include: { Documents: { orderBy: { version: 'desc' }, take: 1 }, committee: true }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        const lastDoc = docDetails.Documents[0];
        if (!lastDoc) return res.status(500).json({ message: 'No versions found' });

        const newVersion = lastDoc.version + 1;
        
        // Code Generation
        const bbb = lastDoc.documentCode.substring(3, 6);
        const committeeCode = CommitteeCodeMap[docDetails.committee.name];
        
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const cc = newVersion.toString().padStart(2, '0');

        const documentCode = `${committeeCode}${bbb}${dateStr}${cc}`;

        // Stamp the PDF
        const { buffer: stampedBuffer, pageCount } = await stampPdf(file.buffer, documentCode);

        // Upload to UploadThing
        const uploadResponse = await utapi.uploadFiles([
            new File([stampedBuffer as any], file.originalname, { type: 'application/pdf' })
        ]);

        if (uploadResponse[0].error) {
             console.error(uploadResponse[0].error);
             return res.status(500).json({ message: 'Failed to upload stamped file' });
        }

        const uploadedUrl = uploadResponse[0].data.ufsUrl;

        const newDoc = await prisma.document.create({
            data: {
                documentCode,
                fileUrl: uploadedUrl,
                docDetailsId: docDetails.id,
                generatedById: userId,
                version: newVersion,
                pageCount,
            }
        });

        return res.json(newDoc);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDocumentsByCommittee = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { HeadOfCommittee: true, CoHeadOfCommittee: true, UserRoles: true }
        });

        if (!user) return res.status(401).json({ message: 'User not found' });
        
        const headCommitteeIds = user.HeadOfCommittee.map(c => c.id);
        const coHeadCommitteeIds = user.CoHeadOfCommittee.map(c => c.id);
        const allCommitteeIds = [...headCommitteeIds, ...coHeadCommitteeIds];

        if (allCommitteeIds.length === 0) return res.json({ owned: [], shared: [] });

        // 1. Fetch Owned Documents
        const ownedDocs = await prisma.documentDetails.findMany({
            where: { committeeId: { in: allCommitteeIds } },
            include: {
                Documents: { orderBy: { version: 'desc' } },
                committee: true,
                documentAccess: { include: { committee: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Fetch Shared Documents via DocumentAccess
        // We find all access records pointing to any of the user's committees
        const accessRecords = await prisma.documentAccess.findMany({
            where: { committeeId: { in: allCommitteeIds } },
            include: {
                document: {
                    include: {
                        Documents: { orderBy: { version: 'desc' } },
                        committee: true
                    }
                }
            }
        });

        // 3. Filter Access Records based on Role
        const validAccessRecords = accessRecords.filter(access => {
            const isHead = headCommitteeIds.includes(access.committeeId);
            const isCoHead = coHeadCommitteeIds.includes(access.committeeId);

            if (isHead) return true; // Heads see everything shared with their committee
            if (isCoHead && access.accessType === 'HEAD_AND_COHEAD') return true; // CoHeads see only shared-to-both
            
            return false;
        });

        // Extract documents from valid access records
        const sharedDocs = validAccessRecords.map(a => ({
            ...a.document,
            sharedVia: a.committeeId // Optional: could help identifying which committee granted access
        }));

        // Remove duplicates if a doc is shared with multiple committees the user leads (though logic suggests one entry per committee)
        // Access records are unique on [docId, committeeId], so simple mapping is fine.
        // But if user is head of A and B, and doc is shared with A and B, it might appear twice?
        // Let's deduplicate by ID just in case.
        const uniqueSharedDocs = Array.from(new Map(sharedDocs.map(item => [item.id, item])).values());

        return res.json({ owned: ownedDocs, shared: uniqueSharedDocs });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getAllDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // Auth: Doc Team or Admin
        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = docCommittee.headUserId === userId;
        const isCoHead = docCommittee.coHeadUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isMember && !isHead && !isCoHead && !isAdmin) {
             return res.status(403).json({ message: 'Forbidden' });
        }
        
        // Define Filter Conditions
        // Admin or Head: See ALL (General + Classified)
        // CoHead: See ALL General + (Own Classified OR Shared Classified)
        // Member: See ALL General Only (No Classified)

        let whereCondition: any = {};

        if (isAdmin || isHead) {
            // No filter, see everything
            whereCondition = {};
        } else if (isCoHead) {
            whereCondition = {
                OR: [
                    { isClassified: false }, // General
                    {
                        AND: [
                            { isClassified: true },
                            {
                                OR: [
                                    // Own Classified (based on generatedBy in Documents)
                                    { Documents: { some: { generatedById: userId } } },
                                    // Shared with CoHead (AccessType HEAD_AND_COHEAD for Doc Committee)
                                    { documentAccess: { some: { committeeId: docCommittee.id, accessType: 'HEAD_AND_COHEAD' } } }
                                ]
                            }
                        ]
                    }
                ]
            };
        } else {
            // Member
            whereCondition = { isClassified: false };
        }

        const docs = await prisma.documentDetails.findMany({
            where: whereCondition,
            include: {
                Documents: {
                    orderBy: { version: 'desc' },
                },
                committee: true,
                documentAccess: { include: { committee: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(docs);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const shareDocumentWithCoHead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId } = req.body;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        // Only Head can share
        if (docCommittee.headUserId !== userId) {
            return res.status(403).json({ message: 'Only Documentation Head can share documents' });
        }

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        
        // Safe approach without unique constraint knowledge:
        const existingAccess = await prisma.documentAccess.findFirst({
            where: { documentId: Number(documentId), committeeId: docCommittee.id }
        });

        if (existingAccess) {
            await prisma.documentAccess.update({
                where: { id: existingAccess.id },
                data: { accessType: 'HEAD_AND_COHEAD' }
            });
        } else {
            await prisma.documentAccess.create({
                data: {
                    documentId: Number(documentId),
                    committeeId: docCommittee.id,
                    accessType: 'HEAD_AND_COHEAD'
                }
            });
        }

        return res.json({ message: 'Document shared with Co-Head' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
