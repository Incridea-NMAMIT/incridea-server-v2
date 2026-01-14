
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
        const { title, description, committee, requestedBy } = req.body;
        const file = req.file;
        const userId = req.user?.id;

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

        const committeeCode = CommitteeCodeMap[committee as CommitteeName];
        if (!committeeCode) return res.status(400).json({ message: 'Invalid committee' });

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

        const uploadedUrl = uploadResponse[0].data.url;

        const result = await prisma.$transaction(async (tx) => {
            const docDetails = await tx.documentDetails.create({
                data: {
                    title,
                    description,
                    committeeId: targetCommittee.id,
                    requestedBy,
                }
            });

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

        const uploadedUrl = uploadResponse[0].data.url;

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
        
        // Admins can see everything? Maybe. But specifically for Head/CoHead view.
        // User asked: "accessible to only the heads/coheads... show list of documents of only that committee"
        
        const committees = [...user.HeadOfCommittee, ...user.CoHeadOfCommittee];
        
        // If Admin, let them see all? Or provide a param?
        // Let's stick to Head logic as requested primarily.
        
        const committeeIds = committees.map(c => c.id);
        
        // Also if Doc Team, they might want to see. But this route is specifically for Operations usage (Head).
        // create a separte route or query param?
        
        // If NO committee heads, return empty.
        if (committeeIds.length === 0) return res.json([]);

        const docs = await prisma.documentDetails.findMany({
            where: { committeeId: { in: committeeIds } },
            include: {
                Documents: {
                    orderBy: { version: 'desc' },
                },
                committee: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(docs);
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
        const isHead = docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isMember && !isHead && !isAdmin) {
             return res.status(403).json({ message: 'Forbidden' });
        }
        
        const docs = await prisma.documentDetails.findMany({
            include: {
                Documents: {
                    orderBy: { version: 'desc' },
                },
                committee: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(docs);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
