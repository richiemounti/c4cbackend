// // tests/stakeholderMapping.test.ts
// import mongoose from 'mongoose';
// import { MongoMemoryServer } from 'mongodb-memory-server';
// import StakeholderGroup from '../models/stakeholderGroup.model';
// import StakeholderTaskOption from '../models/stakeholderTaskOption.model';
// import TaskPrompt from '../models/taskPrompt.model';
// import {
//   initializeTaskPrompts,
//   initializeCategoryTaskOptions,
//   createStakeholderGroup,
//   updateStakeholderTask,
//   getStakeholderCompletionStats
// } from '../services/stakeholderMapping.service';

// // Mock data
// let mongoServer: MongoMemoryServer;
// const userId = new mongoose.Types.ObjectId();
// const projectId = new mongoose.Types.ObjectId();
// const projectSiteId = new mongoose.Types.ObjectId();
// const categoryId = new mongoose.Types.ObjectId();

// describe('Stakeholder Mapping Tests', () => {
//   // Setup MongoDB Memory Server
//   beforeAll(async () => {
//     mongoServer = await MongoMemoryServer.create();
//     const mongoUri = mongoServer.getUri();
//     await mongoose.connect(mongoUri);
//   });

//   // Clear all collections before each test
//   beforeEach(async () => {
//     await Promise.all([
//       StakeholderGroup.deleteMany({}),
//       StakeholderTaskOption.deleteMany({}),
//       TaskPrompt.deleteMany({})
//     ]);
//   });

//   // Disconnect and close MongoDB Memory Server
//   afterAll(async () => {
//     await mongoose.disconnect();
//     await mongoServer.stop();
//   });

//   // Test initializing task prompts
//   test('should initialize task prompts', async () => {
//     await initializeTaskPrompts(userId.toString());
    
//     const prompts = await TaskPrompt.find({});
//     expect(prompts.length).toBe(6); // connections, power, wellbeing, roles, risks, benefits
    
//     const connectionPrompt = await TaskPrompt.findOne({ taskType: 'connections' });
//     expect(connectionPrompt).toBeTruthy();
//     expect(connectionPrompt?.promptText).toBe('How is this group connected to the project?');
//   });

//   // Test initializing category task options
//   test('should initialize category task options', async () => {
//     await initializeCategoryTaskOptions(
//       categoryId.toString(),
//       'Government',
//       userId.toString()
//     );
    
//     const options = await StakeholderTaskOption.find({ category: categoryId });
//     expect(options.length).toBeGreaterThan(0);
    
//     // Check connections options for Government
//     const connectionOptions = await StakeholderTaskOption.find({
//       category: categoryId,
//       taskType: 'connections'
//     });
    
//     expect(connectionOptions.length).toBeGreaterThan(0);
//     expect(connectionOptions[0].label).toBeTruthy();
//   });

//   // Test creating a stakeholder group
//   test('should create a stakeholder group', async () => {
//     const stakeholderGroup = await createStakeholderGroup({
//       project: projectId.toString(),
//       projectSite: projectSiteId.toString(),
//       category: categoryId.toString(),
//       name: 'National Government',
//       description: 'Central government entities',
//       creator: userId.toString()
//     });
    
//     expect(stakeholderGroup).toBeTruthy();
//     expect(stakeholderGroup.name).toBe('National Government');
//     expect(stakeholderGroup.completionStatus).toBe('not_started');
//     expect(stakeholderGroup.tasks.length).toBe(0);
//   });

//   // Test updating a stakeholder task
//   test('should update a stakeholder task', async () => {
//     // First create a stakeholder group
//     const stakeholderGroup = await createStakeholderGroup({
//       project: projectId.toString(),
//       category: categoryId.toString(),
//       name: 'Local Community',
//       creator: userId.toString()
//     });
    
//     // Now update a task
//     const updatedGroup = await updateStakeholderTask(
//       stakeholderGroup._id.toString(),
//       'connections',
//       {
//         responses: [
//           { optionId: 'lives_in_area', description: 'They live in the project area' },
//           { optionId: 'provides_knowledge', description: 'They provide local knowledge' }
//         ],
//         rating: 4
//       },
//       userId.toString()
//     );
    
//     expect(updatedGroup.tasks.length).toBe(1);
//     expect(updatedGroup.tasks[0].taskType).toBe('connections');
//     expect(updatedGroup.tasks[0].responses.length).toBe(2);
//     expect(updatedGroup.tasks[0].rating).toBe(4);
//     expect(updatedGroup.completionStatus).toBe('in_progress');
//   });

//   // Test completion status updates
//   test('should update completion status correctly', async () => {
//     // Create a stakeholder group
//     const stakeholderGroup = await createStakeholderGroup({
//       project: projectId.toString(),
//       category: categoryId.toString(),
//       name: 'Test Group',
//       creator: userId.toString()
//     });
    
//     // Add all required tasks
//     const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    
//     for (const taskType of taskTypes) {
//       await updateStakeholderTask(
//         stakeholderGroup._id.toString(),
//         taskType,
//         {
//           responses: [
//             { optionId: 'test_option', description: 'Test description' }
//           ],
//           rating: 3
//         },
//         userId.toString()
//       );
//     }
    
//     // Reload the stakeholder group
//     const updatedGroup = await StakeholderGroup.findById(stakeholderGroup._id);
    
//     expect(updatedGroup?.completionStatus).toBe('completed');
//     expect(updatedGroup?.tasks.length).toBe(6);
//   });

//   // Test getting completion stats
//   test('should calculate completion statistics correctly', async () => {
//     // Create multiple stakeholder groups
//     const group1 = await createStakeholderGroup({
//       project: projectId.toString(),
//       category: categoryId.toString(),
//       name: 'Group 1',
//       creator: userId.toString()
//     });
    
//     const group2 = await createStakeholderGroup({
//       project: projectId.toString(),
//       category: categoryId.toString(),
//       name: 'Group 2',
//       creator: userId.toString()
//     });
    
//     // Complete all tasks for group1
//     const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
//     for (const taskType of taskTypes) {
//       await updateStakeholderTask(
//         group1._id.toString(),
//         taskType,
//         {
//           responses: [{ optionId: 'test_option', description: 'Test description' }],
//           rating: 3
//         },
//         userId.toString()
//       );
//     }
    
//     // Only complete one task for group2
//     await updateStakeholderTask(
//       group2._id.toString(),
//       'connections',
//       {
//         responses: [{ optionId: 'test_option', description: 'Test description' }],
//         rating: 3
//       },
//       userId.toString()
//     );
    
//     // Get completion stats
//     const stats = await getStakeholderCompletionStats(projectId.toString());
    
//     expect(stats.total).toBe(2);
//     expect(stats.completed).toBe(1);
//     expect(stats.inProgress).toBe(1);
//     expect(stats.notStarted).toBe(0);
//     expect(stats.completionPercentage).toBe(50);
//   });
// });