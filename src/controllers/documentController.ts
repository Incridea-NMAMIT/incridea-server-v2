
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

        let isClassified = isClassifiedStr === 'true';
        let sharedCommittees: { name: string, access: 'HEAD_ONLY' | 'HEAD_AND_COHEAD' }[] = [];
        if (sharedCommitteesStr) {
            try {
                const parsed = JSON.parse(sharedCommitteesStr);
                if (Array.isArray(parsed)) {
                    sharedCommittees = parsed;
                }
            } catch (e) {
            }
        }

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = (docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId);
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });
        const isDocRole = await prisma.userRole.findFirst({ where: { userId, role: 'DOCUMENTATION' } });

        const targetCommittee = await prisma.committee.findUnique({ where: { name: committee } });
        if (!targetCommittee) return res.status(400).json({ message: 'Target committee not found' });

        const isTargetHead = (targetCommittee.headUserId === userId || targetCommittee.coHeadUserId === userId);

        if (!isMember && !isHead && !isAdmin && !isDocRole) {
            if (isTargetHead) {
                if (!targetCommittee.canCreateDocuments) {
                    return res.status(403).json({ message: 'Forbidden: Document creation is disabled for this committee' });
                }

            } else {
                return res.status(403).json({ message: 'Forbidden: You do not have permission to create documents for this committee' });
            }
        }








        if (isTargetHead && !isHead && !isMember && !isAdmin && !isDocRole) {
            if (!targetCommittee.canCreateDocuments) {
                return res.status(403).json({ message: 'Forbidden: Document creation is disabled for this committee' });
            }
            if (isClassified) {
                if (!targetCommittee.canCreateClassified) {
                    return res.status(403).json({ message: 'Forbidden: Classified document creation is disabled for this committee' });
                }
            }
        }



        if (!isHead && !isAdmin && !isTargetHead && isClassified) {
            const allowClassifiedSetting = await prisma.setting.findUnique({ where: { key: 'DOC_ALLOW_CREATE_CLASSIFIED' } });
            if (!allowClassifiedSetting?.value) {
                return res.status(403).json({ message: 'Forbidden: Classified document creation is currently disabled for your role.' });
            }
        }

        let committeeCode = CommitteeCodeMap[committee as CommitteeName];
        if (isClassified) {
            committeeCode = 'CLS';
        }

        if (!committeeCode && !isClassified) return res.status(400).json({ message: 'Invalid committee' });

        const lastDoc = await prisma.document.findFirst({
            where: {
                documentCode: {
                    startsWith: committeeCode
                }
            },
            orderBy: {
                documentCode: 'desc'
            }
        });

        let nextId = 1;
        if (lastDoc) {
            const lastIdStr = lastDoc.documentCode.substring(3, 6);
            const lastId = parseInt(lastIdStr, 10);
            if (!isNaN(lastId)) {
                nextId = lastId + 1;
            }
        }

        const bbb = nextId.toString().padStart(3, '0');

        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const cc = '01';

        const documentCode = `${committeeCode}${bbb}${dateStr}${cc}`;

        const { buffer: stampedBuffer, pageCount } = await stampPdf(file.buffer, documentCode);

        const uploadResponse = await utapi.uploadFiles([
            new File([stampedBuffer as any], file.originalname, { type: 'application/pdf' })
        ]);

        if (uploadResponse[0].error) {
            console.error(uploadResponse[0].error);
            return res.status(500).json({ message: 'Failed to upload stamped file' });
        }

        const uploadedUrl = uploadResponse[0].data.ufsUrl;

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

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = (docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId);
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });
        const isDocRole = await prisma.userRole.findFirst({ where: { userId, role: 'DOCUMENTATION' } });

        if (!isMember && !isHead && !isAdmin && !isDocRole) {
        }

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(docDetailsId) },
            include: { Documents: { orderBy: { version: 'desc' }, take: 1 }, committee: true }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        if (!isMember && !isHead && !isAdmin && !isDocRole) {
            const targetCommittee = docDetails.committee;
            const isTargetHead = (targetCommittee.headUserId === userId || targetCommittee.coHeadUserId === userId);

            if (isTargetHead) {
                if (!targetCommittee.canCreateDocuments) {
                    return res.status(403).json({ message: 'Forbidden: Document creation is disabled for this committee' });
                }
                if (docDetails.isClassified && !targetCommittee.canCreateClassified) {
                    return res.status(403).json({ message: 'Forbidden: You cannot modify classified documents' });
                }
            } else {
                return res.status(403).json({ message: 'Forbidden' });
            }
        }

        const lastDoc = docDetails.Documents[0];
        if (!lastDoc) return res.status(500).json({ message: 'No versions found' });

        if (!isAdmin && !isHead && (isMember || isDocRole)) {
            if (lastDoc.generatedById !== userId) {
                return res.status(403).json({ message: 'Forbidden: You can only revise your own documents.' });
            }
        }

        const newVersion = lastDoc.version + 1;

        const bbb = lastDoc.documentCode.substring(3, 6);
        let committeeCode = CommitteeCodeMap[docDetails.committee.name];
        if (docDetails.isClassified) {
            committeeCode = 'CLS';
        }

        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const cc = newVersion.toString().padStart(2, '0');

        const documentCode = `${committeeCode}${bbb}${dateStr}${cc}`;

        const { buffer: stampedBuffer, pageCount } = await stampPdf(file.buffer, documentCode);

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

        const ownedDocs = await prisma.documentDetails.findMany({
            where: { committeeId: { in: allCommitteeIds } },
            include: {
                Documents: { orderBy: { version: 'desc' } },
                committee: true,
                documentAccess: { include: { committee: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

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

        const validAccessRecords = accessRecords.filter(access => {
            const isHead = headCommitteeIds.includes(access.committeeId);
            const isCoHead = coHeadCommitteeIds.includes(access.committeeId);

            if (isHead || isCoHead) return true; 

            return false;
        });

        const sharedDocs = validAccessRecords.map(a => ({
            ...a.document,
            sharedVia: a.committeeId
        }));

        const userAccessDocs = await prisma.documentUserAccess.findMany({
            where: { userId },
            include: {
                document: {
                    include: {
                        Documents: { orderBy: { version: 'desc' }, take: 1 },
                        committee: true
                    }
                }
            }
        });

        const userSharedDocs = userAccessDocs.map(a => ({
            ...a.document,
            sharedVia: 'USER'
        }));

        const allSharedDocs = [...sharedDocs, ...userSharedDocs];

        const uniqueSharedDocs = Array.from(new Map(allSharedDocs.map(item => [item.id, item])).values());

        const attachUserNames = async (docs: any[]) => {
            return Promise.all(docs.map(async d => {
                const latestDoc = d.Documents[0]; 
                let createdByName = 'Unknown';
                let revisedByName = null;

                if (latestDoc) {
                    const firstDoc = await prisma.document.findFirst({
                        where: { docDetailsId: d.id, version: 1 },
                        select: { generatedById: true }
                    });

                    if (firstDoc) {
                        const creator = await prisma.user.findUnique({
                            where: { id: firstDoc.generatedById },
                            select: { name: true }
                        });
                        createdByName = creator?.name || 'Unknown';
                    }

                    if (latestDoc.version > 1) {
                        const reviser = await prisma.user.findUnique({
                            where: { id: latestDoc.generatedById },
                            select: { name: true }
                        });
                        revisedByName = reviser?.name;
                    }
                }
                return { ...d, createdByName, revisedByName };
            }));
        };

        const ownedDocsWithUser = await attachUserNames(ownedDocs);
        const sharedDocsWithUser = await attachUserNames(uniqueSharedDocs);

        return res.json({ owned: ownedDocsWithUser, shared: sharedDocsWithUser });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getAllDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee.id }
        });
        const isHead = docCommittee.headUserId === userId;
        const isCoHead = docCommittee.coHeadUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });
        const isDocRole = await prisma.userRole.findFirst({ where: { userId, role: 'DOCUMENTATION' } });

        if (!isMember && !isHead && !isCoHead && !isAdmin && !isDocRole) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        let whereCondition: any = {};




        if (isAdmin || isHead || isCoHead) {
            whereCondition = {};
        } else {
            whereCondition = {
                Documents: { some: { generatedById: userId } }
            };
        }

        const docs = await prisma.documentDetails.findMany({
            where: whereCondition,
            include: {
                Documents: {
                    orderBy: { version: 'desc' },
                },
                committee: true,
                documentAccess: { include: { committee: true } },
                documentUserAccesses: { include: { user: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const docsWithUser = await Promise.all(docs.map(async d => {
            const latestDoc = d.Documents[0];
            if (latestDoc) {
                const user = await prisma.user.findUnique({
                    where: { id: latestDoc.generatedById },
                    select: { name: true }
                });
                return { ...d, createdByName: user?.name };
            }
            return d;
        }));

        return res.json(docsWithUser);
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

        if (docCommittee.headUserId !== userId) {
            return res.status(403).json({ message: 'Only Documentation Head can share documents' });
        }

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });




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

export const getSharedDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isHead = docCommittee.headUserId === userId;
        const isCoHead = docCommittee.coHeadUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isHead && !isCoHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (isCoHead) {
            const shareSharedSetting = await prisma.setting.findUnique({ where: { key: 'DOC_SHARE_SHARED' } });
            if (!shareSharedSetting?.value) {
                return res.json([]);
            }
        }

        const incomingDocs = await prisma.documentDetails.findMany({
            where: {
                isClassified: true,
                committeeId: { not: docCommittee.id }
            },
            include: {
                Documents: { orderBy: { version: 'desc' }, take: 1 },
                committee: true,
                documentAccess: { include: { committee: true } },
                documentUserAccesses: { include: { user: { include: { HeadOfCommittee: true, CoHeadOfCommittee: true } } } }
            }
        });

        const outgoingDocs = await prisma.documentDetails.findMany({
            where: {
                committeeId: docCommittee.id,
                OR: [
                    { documentAccess: { some: {} } },
                    { documentUserAccesses: { some: {} } }
                ]
            },
            include: {
                Documents: { orderBy: { version: 'desc' }, take: 1 },
                committee: true,
                documentAccess: { include: { committee: true } },
                documentUserAccesses: { include: { user: { include: { HeadOfCommittee: true, CoHeadOfCommittee: true } } } }
            }
        });

        const allDocs = [...incomingDocs, ...outgoingDocs];


        const docsWithUser = await Promise.all(allDocs.map(async d => {
            const latestDoc = d.Documents[0];
            let createdByName = 'Unknown';
            let revisedByName = null;
            if (latestDoc) {
                const firstDoc = await prisma.document.findFirst({
                    where: { docDetailsId: d.id, version: 1 },
                    select: { generatedById: true }
                });
                if (firstDoc) {
                    const creator = await prisma.user.findUnique({ where: { id: firstDoc.generatedById }, select: { name: true } });
                    createdByName = creator?.name || 'Unknown';
                }
                if (latestDoc.version > 1) {
                    const reviser = await prisma.user.findUnique({ where: { id: latestDoc.generatedById }, select: { name: true } });
                    revisedByName = reviser?.name;
                }
            }
            return { ...d, createdByName, revisedByName };
        }));

        return res.json(docsWithUser);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const getDocumentSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const settings = await prisma.setting.findMany({
            where: {
                key: { in: ['DOC_SHARE_CLASSIFIED', 'DOC_ALLOW_CREATE_CLASSIFIED', 'DOC_SHARE_SHARED'] }
            }
        });

        const result = {
            shareClassified: settings.find(s => s.key === 'DOC_SHARE_CLASSIFIED')?.value ?? false,
            allowCreateClassified: settings.find(s => s.key === 'DOC_ALLOW_CREATE_CLASSIFIED')?.value ?? false,
            shareShared: settings.find(s => s.key === 'DOC_SHARE_SHARED')?.value ?? false
        };

        return res.json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDocumentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(id) },
            include: {
                Documents: { orderBy: { version: 'desc' }, take: 1 },
                committee: true,
                documentAccess: true,
                documentUserAccesses: true
            }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        let hasAccess = false;

        const firstDoc = await prisma.document.findFirst({
            where: { docDetailsId: docDetails.id, version: 1 },
            select: { generatedById: true }
        });
        if (firstDoc?.generatedById === userId) {
            hasAccess = true;
        }

        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });
        if (isAdmin) hasAccess = true;

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!hasAccess && docCommittee) {
            if (docCommittee.headUserId === userId || docCommittee.coHeadUserId === userId) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            const owningCommittee = docDetails.committee;
            if (owningCommittee.headUserId === userId || owningCommittee.coHeadUserId === userId) {
                hasAccess = true; 
            }
        }

        if (!hasAccess) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { HeadOfCommittee: true, CoHeadOfCommittee: true }
            });

            if (user) {
                const headCommitteeIds = user.HeadOfCommittee.map(c => c.id);
                const coHeadCommitteeIds = user.CoHeadOfCommittee.map(c => c.id);

                for (const access of docDetails.documentAccess) {
                    if (headCommitteeIds.includes(access.committeeId)) {
                        hasAccess = true;
                        break;
                    }
                    if (coHeadCommitteeIds.includes(access.committeeId) && access.accessType === 'HEAD_AND_COHEAD') {
                        hasAccess = true;
                        break;
                    }
                }
            }
        }

        if (!hasAccess) {
            const userAccess = docDetails.documentUserAccesses.find(ua => ua.userId === userId);
            if (userAccess) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view this document.' });
        }

        const latestDoc = docDetails.Documents[0];
        let createdByName = 'Unknown';
        if (latestDoc) {
            const firstDoc = await prisma.document.findFirst({
                where: { docDetailsId: docDetails.id, version: 1 },
                select: { generatedById: true }
            });
            if (firstDoc) {
                const creator = await prisma.user.findUnique({ where: { id: firstDoc.generatedById }, select: { name: true } });
                createdByName = creator?.name || 'Unknown';
            }
        }

        return res.json({ ...docDetails, createdByName });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};




export const updateDocumentSettings = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const { key, value } = req.body;
        if (typeof value !== 'boolean') return res.status(400).json({ message: 'Value must be boolean' });
        if (!['DOC_SHARE_CLASSIFIED', 'DOC_ALLOW_CREATE_CLASSIFIED', 'DOC_SHARE_SHARED'].includes(key)) {
            return res.status(400).json({ message: 'Invalid setting key' });
        }

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        if (!docCommittee) return res.status(500).json({ message: 'Documentation committee not found' });

        const isHead = docCommittee.headUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Only Head can change settings' });
        }

        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });

        return res.json(setting);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const getEligibleUsersForSharing = async (_req: AuthenticatedRequest, res: Response) => {
    try {

        const headsAndCoHeads = await prisma.committee.findMany({
            select: { headUser: true, coHeadUser: true, name: true }
        });

        const docCommittee = await prisma.committee.findUnique({
            where: { name: 'DOCUMENTATION' },
            include: { Members: { include: { User: true } } }
        });

        const usersMap = new Map<number, { id: number, name: string, email: string, role: string }>();

        headsAndCoHeads.forEach(c => {
            if (c.headUser) {
                const existing = usersMap.get(c.headUser.id);
                const roleStr = `Head of ${c.name}`;
                if (existing) {
                    if (!existing.role.includes(roleStr)) existing.role += `, ${roleStr}`;
                } else {
                    usersMap.set(c.headUser.id, { id: c.headUser.id, name: c.headUser.name, email: c.headUser.email, role: roleStr });
                }
            }
            if (c.coHeadUser) {
                const existing = usersMap.get(c.coHeadUser.id);
                const roleStr = `Co-Head of ${c.name}`;
                if (existing) {
                    if (!existing.role.includes(roleStr)) existing.role += `, ${roleStr}`;
                } else {
                    usersMap.set(c.coHeadUser.id, { id: c.coHeadUser.id, name: c.coHeadUser.name, email: c.coHeadUser.email, role: roleStr });
                }
            }
        });

        docCommittee?.Members.forEach(m => {
            if (m.User) {
                if (!usersMap.has(m.User.id)) {
                    usersMap.set(m.User.id, { id: m.User.id, name: m.User.name, email: m.User.email, role: 'Documentation Team' });
                }
            }
        });

        const docRoleUsers = await prisma.userRole.findMany({
            where: { role: 'DOCUMENTATION' },
            include: { User: true }
        });

        docRoleUsers.forEach(ur => {
            if (ur.User) {
                if (!usersMap.has(ur.User.id)) {
                    usersMap.set(ur.User.id, { id: ur.User.id, name: ur.User.name, email: ur.User.email, role: 'Documentation Team' });
                }
            }
        });

        return res.json(Array.from(usersMap.values()));
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const shareDocumentWithUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId, userIds } = req.body; 
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) },
            include: { Documents: true } 
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });



        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        const isDocHead = docCommittee?.headUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        const firstDoc = await prisma.document.findFirst({ where: { docDetailsId: docDetails.id }, orderBy: { version: 'asc' } });
        const isOwner = firstDoc?.generatedById === userId;

        if (!isOwner && !isDocHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Only the owner or Documentation Head can share this document' });
        }

        if (!Array.isArray(userIds)) return res.status(400).json({ message: 'Invalid users list' });

        await prisma.documentUserAccess.createMany({
            data: userIds.map((uid: number) => ({
                documentId: Number(documentId),
                userId: uid
            })),
            skipDuplicates: true
        });

        return res.json({ message: 'Document shared successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const editDocumentDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId, title, description, committee } = req.body;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) },
            include: { documentUserAccesses: true }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });



        const hasDirectAccess = docDetails.documentUserAccesses.some(a => a.userId === userId);

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        const isDocMember = await prisma.committeeMembership.findFirst({
            where: { userId, committeeId: docCommittee?.id }
        });
        const isDocHead = docCommittee?.headUserId === userId || docCommittee?.coHeadUserId === userId;
        const hasDocRole = isDocMember || isDocHead;

        const firstDoc = await prisma.document.findFirst({ where: { docDetailsId: docDetails.id }, orderBy: { version: 'asc' } });
        const isOwner = firstDoc?.generatedById === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });



        if (!isOwner && !hasDirectAccess && !isAdmin && !hasDocRole) { 
            return res.status(403).json({ message: 'Forbidden' });
        }

        const updateData: any = { title, description };

        if (committee) {
            const targetCommittee = await prisma.committee.findUnique({ where: { name: committee as CommitteeName } });
            if (!targetCommittee) return res.status(400).json({ message: 'Invalid committee' });
            updateData.committeeId = targetCommittee.id;
        }

        await prisma.documentDetails.update({
            where: { id: Number(documentId) },
            data: updateData
        });

        return res.json({ message: 'Document updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDocumentUserAccess = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) },
            include: { documentUserAccesses: { include: { user: true } } }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        const isDocHead = docCommittee?.headUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        const firstDoc = await prisma.document.findFirst({ where: { docDetailsId: docDetails.id }, orderBy: { version: 'asc' } });
        const isOwner = firstDoc?.generatedById === userId;

        if (!isOwner && !isDocHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const accesses = docDetails.documentUserAccesses.map(a => ({
            id: a.userId,
            name: a.user.name,
            email: a.user.email,
            role: 'User'
        }));

        return res.json(accesses);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const removeDocumentUserAccess = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId, targetUserId } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docDetails = await prisma.documentDetails.findUnique({
            where: { id: Number(documentId) }
        });

        if (!docDetails) return res.status(404).json({ message: 'Document not found' });

        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        const isDocHead = docCommittee?.headUserId === userId;
        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        const firstDoc = await prisma.document.findFirst({ where: { docDetailsId: docDetails.id }, orderBy: { version: 'asc' } });
        const isOwner = firstDoc?.generatedById === userId;

        if (!isOwner && !isDocHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await prisma.documentUserAccess.deleteMany({
            where: {
                documentId: Number(documentId),
                userId: Number(targetUserId)
            }
        });

        return res.json({ message: 'Access removed successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDocumentByCode = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { code } = req.params;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const document = await prisma.document.findUnique({
            where: { documentCode: code },
            include: {
                docDetails: {
                    include: {
                        committee: true,
                        documentAccess: { include: { committee: true } },
                        documentUserAccesses: { include: { user: true } }, 
                        Documents: {
                            orderBy: { version: 'desc' }
                        }
                    }
                },
                generatedBy: true
            }
        });

        if (!document) return res.status(404).json({ message: 'Document not found' });


        const docCommittee = await prisma.committee.findUnique({ where: { name: 'DOCUMENTATION' } });
        const isDocHead = docCommittee?.headUserId === userId; 

        const isAdmin = await prisma.userRole.findFirst({ where: { userId, role: 'ADMIN' } });

        if (!isDocHead && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Only Documentation Head and Admin can scan documents' });
        }

        const docDetails = document.docDetails;

        const revisions = await Promise.all(docDetails.Documents.map(async doc => {
            const generator = await prisma.user.findUnique({
                where: { id: doc.generatedById },
                select: { name: true }
            });
            return {
                ...doc,
                generatedByName: generator?.name || 'Unknown'
            };
        }));

        const responseData = {
            ...docDetails,
            Documents: revisions,
            currentVersion: document,
            committeeName: docDetails.committee.name,
            sharedAccess: docDetails.documentAccess.map(da => ({
                committee: da.committee.name,
                access: da.accessType
            }))
        };

        return res.json(responseData);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getUserSharedDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const docs = await prisma.documentDetails.findMany({
            where: {
                documentUserAccesses: {
                    some: { userId: userId }
                }
            },
            include: {
                Documents: { orderBy: { version: 'desc' } },
                committee: true,
                documentAccess: { include: { committee: true } },
                documentUserAccesses: { include: { user: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const docsWithUser = await Promise.all(docs.map(async d => {
            const latestDoc = d.Documents[0];
            let createdByName = 'Unknown';
            let revisedByName = null;
            if (latestDoc) {
                const firstDoc = await prisma.document.findFirst({
                    where: { docDetailsId: d.id, version: 1 },
                    select: { generatedById: true }
                });
                if (firstDoc) {
                    const creator = await prisma.user.findUnique({ where: { id: firstDoc.generatedById }, select: { name: true } });
                    createdByName = creator?.name || 'Unknown';
                }
                if (latestDoc.version > 1) {
                    const reviser = await prisma.user.findUnique({ where: { id: latestDoc.generatedById }, select: { name: true } });
                    revisedByName = reviser?.name;
                }
            }
            return { ...d, createdByName, revisedByName };
        }));

        return res.json(docsWithUser);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
