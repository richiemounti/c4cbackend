// routes/taskUpdate.routes.ts
import { Router } from 'express';
import { updateProjectTasks, updateProjectSiteTasks, updateSpecificTask } from '../controllers/taskUpdate.controller';
import authorize from '../middlewares/auth.middleware';

const taskRouter = Router();

// Apply authentication middleware to all routes
/**
 * @route POST /api/v1/admin/tasks/update-project-tasks
 * @desc Apply all project task modifications
 * @access Private (Admin only)
 */
taskRouter.post('/update-project-tasks', authorize, updateProjectTasks);

/**
 * @route POST /api/v1/admin/tasks/update-project-site-tasks
 * @desc Apply all project site task modifications
 * @access Private (Admin only)
 */
taskRouter.post('/update-project-site-tasks', authorize, updateProjectSiteTasks);


/**
 * @route POST /api/v1/admin/tasks/update-task
 * @desc Update specific task globally
 * @access Private (Admin only)
 */
taskRouter.post('/update-task', authorize, updateSpecificTask);

export default taskRouter;