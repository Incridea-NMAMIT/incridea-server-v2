
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { upload } from '../config/multerConfig'; 
import { createDocument, addRevision, getDocumentsByCommittee, getAllDocuments, shareDocumentWithCoHead, getSharedDocuments, getDocumentSettings, updateDocumentSettings, getEligibleUsersForSharing, shareDocumentWithUsers, editDocumentDetails } from '../controllers/documentController';

const router = Router();

router.use(authenticateJWT);

// Create new document (Doc Team)
router.post('/create-document', authenticateJWT, upload.single('file'), createDocument);

// Add revision (Doc Team)
router.post('/add-revision', authenticateJWT, upload.single('file'), addRevision);

// Get documents for my committee (Head/CoHead)
router.get('/', getDocumentsByCommittee);

// Get shared documents (Doc Head)
router.get('/shared', getSharedDocuments);

// Get all documents (Doc Team/Admin)
router.get('/all', getAllDocuments);

// Share document (Doc Head)
router.post('/share-document', authenticateJWT, shareDocumentWithCoHead);

// Document Settings (Head/CoHead)
router.get('/settings', getDocumentSettings);
router.post('/settings', updateDocumentSettings);

// User Sharing & Editing
router.get('/eligible-users', getEligibleUsersForSharing);
router.post('/share-users', shareDocumentWithUsers);
router.post('/edit-details', editDocumentDetails);

export default router;
