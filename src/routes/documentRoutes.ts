
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { createDocument, addRevision, getDocumentsByCommittee, getAllDocuments } from '../controllers/documentController';

const router = Router();

router.use(authenticateJWT);

// Create new document (Doc Team)
router.post('/', createDocument);

// Add revision (Doc Team)
router.post('/revision', addRevision);

// Get documents for my committee (Head/CoHead)
router.get('/', getDocumentsByCommittee);

// Get all documents (Doc Team/Admin)
router.get('/all', getAllDocuments);

export default router;
