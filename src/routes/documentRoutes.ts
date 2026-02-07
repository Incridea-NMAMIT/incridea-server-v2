
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { upload } from '../config/multerConfig'; 
import { createDocument, addRevision, getDocumentsByCommittee, getAllDocuments, shareDocumentWithCoHead, getSharedDocuments, getDocumentSettings, updateDocumentSettings, getEligibleUsersForSharing, shareDocumentWithUsers, editDocumentDetails, getDocumentUserAccess, removeDocumentUserAccess, getDocumentByCode, getUserSharedDocuments, getDocumentById } from '../controllers/documentController';

const router = Router();

router.use(authenticateJWT);

router.get('/code/:code', getDocumentByCode);

router.post('/create-document', authenticateJWT, upload.single('file'), createDocument);

router.post('/add-revision', authenticateJWT, upload.single('file'), addRevision);

router.get('/', getDocumentsByCommittee);

router.get('/shared', getSharedDocuments);

router.get('/all', getAllDocuments);

router.post('/share-document', authenticateJWT, shareDocumentWithCoHead);

router.get('/settings', getDocumentSettings);
router.post('/settings', updateDocumentSettings);

router.get('/eligible-users', getEligibleUsersForSharing);
router.post('/share-users', shareDocumentWithUsers);
router.post('/edit-details', editDocumentDetails);

router.get('/:documentId/access', getDocumentUserAccess);
router.delete('/:documentId/access/:targetUserId', removeDocumentUserAccess);

router.get('/user-shared', getUserSharedDocuments);

router.get('/:id', getDocumentById);

export default router;
