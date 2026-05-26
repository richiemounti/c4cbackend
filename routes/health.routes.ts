import { Router, Request, Response } from "express";
import { checkDatabaseConnection } from "../database/mongodb";

const healthRouter = Router();

/**
 * Health check endpoint
 * Returns status of API and its dependencies
 */
healthRouter.get('/', async (req: Request, res: Response) => {
  // Check database connection
  const isDatabaseConnected = await checkDatabaseConnection();
  
  // Overall health status
  const isHealthy = isDatabaseConnected;
  
  const status = {
    status: isHealthy ? 'ok' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: isDatabaseConnected ? 'connected' : 'disconnected'
      },
      api: {
        status: 'running',
        uptime: process.uptime()
      }
    }
  };
  
  // Return appropriate status code
  const statusCode = isHealthy ? 200 : 503;
  
  res.status(statusCode).json(status);
});

export default healthRouter;