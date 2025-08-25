import { Task, ScheduleBlock, Priority } from '@/types/task';

export class AITaskScheduler {
  private tasks: Task[] = [];
  private workingHours = { start: 9, end: 17 }; // 9 AM to 5 PM
  private maxContinuousWork = 90; // minutes
  private shortBreak = 10; // minutes
  private longBreak = 30; // minutes

  setTasks(tasks: Task[]) {
    this.tasks = tasks.filter(task => !task.completed);
  }

  generateSchedule(date: Date = new Date()): ScheduleBlock[] {
    const schedule: ScheduleBlock[] = [];
    const sortedTasks = this.prioritizeTasks();
    
    if (sortedTasks.length === 0) return schedule;

    const startOfDay = new Date(date);
    startOfDay.setHours(this.workingHours.start, 0, 0, 0);
    
    let currentTime = new Date(startOfDay);
    let continuousWorkTime = 0;

    for (const task of sortedTasks) {
      // Check if we need a break
      if (continuousWorkTime >= this.maxContinuousWork) {
        const breakDuration = continuousWorkTime >= 180 ? this.longBreak : this.shortBreak;
        const breakBlock: ScheduleBlock = {
          id: `break-${currentTime.getTime()}`,
          type: 'break',
          startTime: new Date(currentTime),
          endTime: new Date(currentTime.getTime() + breakDuration * 60000),
          title: breakDuration === this.longBreak ? 'Long Break' : 'Short Break',
          description: 'Time to recharge and stay productive'
        };
        
        schedule.push(breakBlock);
        currentTime = new Date(breakBlock.endTime);
        continuousWorkTime = 0;
      }

      // Add the task
      const taskBlock: ScheduleBlock = {
        id: `task-${task.id}`,
        type: 'task',
        taskId: task.id,
        task,
        startTime: new Date(currentTime),
        endTime: new Date(currentTime.getTime() + task.duration * 60000),
        title: task.name,
        description: `${task.type} • ${task.priority} priority • ${task.duration}m`
      };

      schedule.push(taskBlock);
      currentTime = new Date(taskBlock.endTime);
      continuousWorkTime += task.duration;

      // Check if we've exceeded working hours
      if (currentTime.getHours() >= this.workingHours.end) {
        break;
      }
    }

    return schedule;
  }

  private prioritizeTasks(): Task[] {
    const now = new Date();
    
    return [...this.tasks].sort((a, b) => {
      // Priority score calculation
      const getUrgencyScore = (task: Task) => {
        const timeToDeadline = task.deadline.getTime() - now.getTime();
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
        
        // Higher score = more urgent
        let score = 0;
        
        // Deadline urgency (0-100)
        if (hoursToDeadline <= 24) score += 100;
        else if (hoursToDeadline <= 48) score += 80;
        else if (hoursToDeadline <= 168) score += 60; // 1 week
        else score += 20;
        
        // Priority weight (0-50)
        if (task.priority === 'high') score += 50;
        else if (task.priority === 'medium') score += 30;
        else score += 10;
        
        // Task type weight (0-20)
        if (task.type === 'work') score += 20;
        else if (task.type === 'study') score += 15;
        else score += 5;
        
        return score;
      };
      
      return getUrgencyScore(b) - getUrgencyScore(a);
    });
  }

  estimateCompletion(tasks: Task[]): Date {
    const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
    const breaksNeeded = Math.floor(totalDuration / this.maxContinuousWork);
    const totalBreakTime = breaksNeeded * this.shortBreak;
    const totalTime = totalDuration + totalBreakTime;
    
    const now = new Date();
    return new Date(now.getTime() + totalTime * 60000);
  }
}