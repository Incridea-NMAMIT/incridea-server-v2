
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { upload } from '../config/multerConfig'; 
import { createDocument, addRevision, getDocumentsByCommittee, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.use(authenticateJWT);

// Create new document (Doc Team)
router.post('/create-document', authenticateJWT, upload.single('file'), createDocument);

// Add revision (Doc Team)
router.post('/add-revision', authenticateJWT, upload.single('file'), addRevision);

// Get documents for my committee (Head/CoHead)
router.get('/', getDocumentsByCommittee);

// Get all documents (Doc Team/Admin)
router.get('/all', getAllDocuments);

export default router;
