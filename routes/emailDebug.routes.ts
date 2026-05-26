// routes/emailDebug.routes.ts
import { Router } from 'express';
import { debugEmailConfig, testGmailConnection, sendTestEmail } from '../controllers/emailDebug.controller';

const emailDebugRouter = Router();

emailDebugRouter.get('/email', debugEmailConfig);
emailDebugRouter.post('/email/test-connection', testGmailConnection);
emailDebugRouter.post('/email/send-test', sendTestEmail);

export default emailDebugRouter;