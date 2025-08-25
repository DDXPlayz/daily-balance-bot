export type TaskType = 'work' | 'study' | 'leisure';
export type Priority = 'low' | 'medium' | 'high';
export type BlockType = 'task' | 'break' | 'unavailable';

export interface Task {
  id: string;
  name: string;
  duration: number; // in minutes
  deadline: Date;
  priority: Priority;
  type: TaskType;
  completed: boolean;
  createdAt: Date;
  scheduledTime?: Date; // When task is scheduled in timetable
}

export interface TimeBlock {
  id: string;
  type: BlockType;
  startTime: Date;
  endTime: Date;
  title: string;
  description?: string;
  taskId?: string;
  task?: Task;
  isFixed?: boolean; // Can't be moved (for unavailable blocks)
}

export interface UnavailableBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  title: string;
  description?: string;
  recurring?: {
    type: 'daily' | 'weekly';
    days?: number[]; // 0-6 for weekly (0 = Sunday)
  };
}

export interface ScheduleBlock {
  id: string;
  type: 'task' | 'break';
  taskId?: string;
  task?: Task;
  startTime: Date;
  endTime: Date;
  title: string;
  description?: string;
}