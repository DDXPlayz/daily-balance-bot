export type TaskType = 'work' | 'study' | 'leisure';
export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  name: string;
  duration: number; // in minutes
  deadline: Date;
  priority: Priority;
  type: TaskType;
  completed: boolean;
  createdAt: Date;
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