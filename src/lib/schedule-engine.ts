import { Task, TimeBlock, UnavailableBlock, Priority, TaskType } from '@/types/task';

export interface ScheduleEngineConfig {
  workingHours: { start: number; end: number };
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  maxContinuousWork: number; // minutes before mandatory break
  longBreakThreshold: number; // minutes of work before long break needed
}

export class ScheduleEngine {
  private config: ScheduleEngineConfig = {
    workingHours: { start: 9, end: 17 },
    shortBreakDuration: 15,
    longBreakDuration: 30,
    maxContinuousWork: 90,
    longBreakThreshold: 180
  };

  private tasks: Task[] = [];
  private unavailableBlocks: UnavailableBlock[] = [];
  private schedule: TimeBlock[] = [];
  
  // Track ad-hoc unavailable blocks by date (YYYY-MM-DD format)
  private adHocUnavailableByDate: Map<string, TimeBlock[]> = new Map();
  
  // Track suppressed recurring instances by date and block ID
  private suppressedRecurringInstances: Map<string, Set<string>> = new Map();

  setTasks(tasks: Task[]) {
    this.tasks = tasks.filter(t => !t.completed);
    this.regenerateSchedule();
  }

  setUnavailableBlocks(blocks: UnavailableBlock[]) {
    this.unavailableBlocks = blocks;
    this.regenerateSchedule();
  }

  setConfig(config: Partial<ScheduleEngineConfig>) {
    this.config = { ...this.config, ...config };
    this.regenerateSchedule();
  }

  generateSchedule(date: Date = new Date()): TimeBlock[] {
    this.schedule = [];
    const workDay = this.createWorkDay(date);
    const dateKey = this.getDateKey(date);
    
    // Add all unavailable blocks (recurring + ad-hoc) first
    this.addUnavailableBlocks(workDay, dateKey);
    
    // Sort tasks by priority and deadline
    const prioritizedTasks = this.prioritizeTasks(date);
    
    // Schedule tasks with intelligent breaks
    this.scheduleTasks(prioritizedTasks, workDay);
    
    return [...this.schedule].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  getSchedule(): TimeBlock[] {
    return [...this.schedule];
  }

  rescheduleTask(taskId: string, newStartTime: Date): TimeBlock[] {
    const taskBlock = this.schedule.find(b => b.taskId === taskId);
    if (!taskBlock) return this.schedule;

    const task = taskBlock.task;
    if (!task) return this.schedule;

    const newEndTime = new Date(newStartTime.getTime() + task.duration * 60000);
    
    // Check if new slot is available
    if (this.isSlotAvailable(newStartTime, newEndTime, taskId)) {
      // Remove old task block
      this.schedule = this.schedule.filter(b => b.taskId !== taskId);
      
      // Add task at new time
      const newTaskBlock: TimeBlock = {
        id: `task-${task.id}-${newStartTime.getTime()}`,
        type: 'task',
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        title: task.name,
        description: `${task.type} • ${task.priority} priority • ${task.duration}m`,
        taskId: task.id,
        task
      };
      
      this.schedule.push(newTaskBlock);
      
      // Regenerate breaks around the new position
      this.regenerateBreaks();
    }
    
    return this.getSchedule();
  }

  addUnavailableTime(startTime: Date, endTime: Date, title: string, description?: string): TimeBlock[] {
    const dateKey = this.getDateKey(startTime);
    const unavailableBlock: TimeBlock = {
      id: `ad-hoc-${startTime.getTime()}`,
      type: 'unavailable',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      title,
      description,
      isFixed: true
    };
    
    // Store as ad-hoc unavailable block for this date
    if (!this.adHocUnavailableByDate.has(dateKey)) {
      this.adHocUnavailableByDate.set(dateKey, []);
    }
    this.adHocUnavailableByDate.get(dateKey)!.push(unavailableBlock);
    
    // Regenerate entire schedule to handle conflicts
    return this.generateSchedule(startTime);
  }

  deleteTimeBlock(blockId: string): TimeBlock[] {
    // Find the block to determine the date
    const block = this.schedule.find(b => b.id === blockId);
    if (!block) return this.getSchedule();
    
    const dateKey = this.getDateKey(block.startTime);
    
    // Handle ad-hoc unavailable block deletion
    if (blockId.startsWith('ad-hoc-')) {
      const adHocBlocks = this.adHocUnavailableByDate.get(dateKey) || [];
      const filteredBlocks = adHocBlocks.filter(b => b.id !== blockId);
      
      if (filteredBlocks.length === 0) {
        this.adHocUnavailableByDate.delete(dateKey);
      } else {
        this.adHocUnavailableByDate.set(dateKey, filteredBlocks);
      }
      
      // Regenerate entire schedule
      return this.generateSchedule(block.startTime);
    }
    
    // Handle recurring unavailable block deletion (suppress for this date only)
    if (blockId.startsWith('unavailable-')) {
      const recurringBlockId = blockId.split('-')[1]; // Extract original block ID
      
      if (!this.suppressedRecurringInstances.has(dateKey)) {
        this.suppressedRecurringInstances.set(dateKey, new Set());
      }
      this.suppressedRecurringInstances.get(dateKey)!.add(recurringBlockId);
      
      // Regenerate entire schedule
      return this.generateSchedule(block.startTime);
    }
    
    // Handle task or break deletion
    this.schedule = this.schedule.filter(b => b.id !== blockId);
    
    const wasTask = blockId.startsWith('task-');
    if (wasTask) {
      this.regenerateBreaks();
    }
    
    return this.getSchedule();
  }

  private createWorkDay(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(this.config.workingHours.start, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(this.config.workingHours.end, 0, 0, 0);
    
    return { start, end };
  }

  private addUnavailableBlocks(workDay: { start: Date; end: Date }, dateKey: string) {
    const targetDate = workDay.start;
    const suppressedIds = this.suppressedRecurringInstances.get(dateKey) || new Set();
    
    // Add recurring unavailable blocks
    for (const block of this.unavailableBlocks) {
      // Skip if this recurring instance is suppressed for this date
      if (suppressedIds.has(block.id)) continue;
      
      if (this.shouldIncludeBlock(block, targetDate)) {
        const startTime = new Date(targetDate);
        startTime.setHours(block.startTime.getHours(), block.startTime.getMinutes(), 0, 0);
        
        const endTime = new Date(targetDate);
        endTime.setHours(block.endTime.getHours(), block.endTime.getMinutes(), 0, 0);
        
        // Add if there's any overlap with working hours
        if (this.timeSlotsOverlap(startTime, endTime, workDay.start, workDay.end)) {
          // Trim to working hours if necessary
          const clampedStart = new Date(Math.max(startTime.getTime(), workDay.start.getTime()));
          const clampedEnd = new Date(Math.min(endTime.getTime(), workDay.end.getTime()));
          
          this.schedule.push({
            id: `unavailable-${block.id}-${targetDate.getTime()}`,
            type: 'unavailable',
            startTime: clampedStart,
            endTime: clampedEnd,
            title: block.title,
            description: block.description,
            isFixed: true
          });
        }
      }
    }
    
    // Add ad-hoc unavailable blocks for this date
    const adHocBlocks = this.adHocUnavailableByDate.get(dateKey) || [];
    for (const block of adHocBlocks) {
      // Only add if within working hours and overlaps
      if (this.timeSlotsOverlap(block.startTime, block.endTime, workDay.start, workDay.end)) {
        // Trim to working hours if necessary
        const clampedStart = new Date(Math.max(block.startTime.getTime(), workDay.start.getTime()));
        const clampedEnd = new Date(Math.min(block.endTime.getTime(), workDay.end.getTime()));
        
        this.schedule.push({
          ...block,
          startTime: clampedStart,
          endTime: clampedEnd
        });
      }
    }
  }

  private shouldIncludeBlock(block: UnavailableBlock, date: Date): boolean {
    if (!block.recurring) return true;
    
    if (block.recurring.type === 'daily') return true;
    
    if (block.recurring.type === 'weekly' && block.recurring.days) {
      const dayOfWeek = date.getDay();
      return block.recurring.days.includes(dayOfWeek);
    }
    
    return false;
  }

  private prioritizeTasks(targetDate: Date): Task[] {
    const now = new Date();
    
    return [...this.tasks].sort((a, b) => {
      const getUrgencyScore = (task: Task) => {
        const timeToDeadline = task.deadline.getTime() - now.getTime();
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
        
        let score = 0;
        
        // Deadline urgency (0-100)
        if (hoursToDeadline <= 24) score += 100;
        else if (hoursToDeadline <= 48) score += 80;
        else if (hoursToDeadline <= 168) score += 60;
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

  private scheduleTasks(tasks: Task[], workDay: { start: Date; end: Date }) {
    // Start from current time if within working hours; otherwise from day start
    const now = new Date();
    const startFrom = (now >= workDay.start && now < workDay.end) ? this.roundUpToMinutes(now, 5) : new Date(workDay.start);
    let currentTime = startFrom;
    let continuousWorkTime = 0;
    
    for (const task of tasks) {
      // Check if we need a break before this task
      if (continuousWorkTime >= this.config.maxContinuousWork) {
        const breakDuration = continuousWorkTime >= this.config.longBreakThreshold 
          ? this.config.longBreakDuration 
          : this.config.shortBreakDuration;
        
        const breakEndTime = new Date(currentTime.getTime() + breakDuration * 60000);
        
        // Only add break if it fits in working hours
        if (breakEndTime <= workDay.end) {
          this.schedule.push({
            id: `break-${currentTime.getTime()}`,
            type: 'break',
            startTime: new Date(currentTime),
            endTime: breakEndTime,
            title: breakDuration === this.config.longBreakDuration ? 'Long Break' : 'Short Break',
            description: 'Time to recharge and stay productive'
          });
          
          currentTime = new Date(breakEndTime);
          continuousWorkTime = 0;
        }
      }
      
      // Find next available slot for this task
      const slot = this.findAvailableSlot(currentTime, task.duration, workDay.end);
      if (!slot) break; // No more slots available today
      
      // Add the task
      this.schedule.push({
        id: `task-${task.id}-${slot.start.getTime()}`,
        type: 'task',
        startTime: new Date(slot.start),
        endTime: new Date(slot.end),
        title: task.name,
        description: `${task.type} • ${task.priority} priority • ${task.duration}m`,
        taskId: task.id,
        task
      });
      
      currentTime = new Date(slot.end);
      continuousWorkTime += task.duration;
      
      // Stop if we've exceeded working hours
      if (currentTime >= workDay.end) break;
    }
  }

  private findAvailableSlot(startTime: Date, duration: number, endOfDay: Date): { start: Date; end: Date } | null {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // Check if slot exceeds working hours
    if (endTime > endOfDay) return null;
    
    // Check for conflicts with existing blocks
    const hasConflict = this.schedule.some(block => 
      this.timeSlotsOverlap(startTime, endTime, block.startTime, block.endTime)
    );
    
    if (!hasConflict) {
      return { start: startTime, end: endTime };
    }
    
    // Find next available slot after conflicts
    const sortedBlocks = [...this.schedule]
      .filter(b => b.endTime > startTime)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    let nextStart = new Date(startTime);
    
    for (const block of sortedBlocks) {
      const proposedEnd = new Date(nextStart.getTime() + duration * 60000);
      
      if (proposedEnd <= block.startTime) {
        // Slot fits before this block
        return { start: nextStart, end: proposedEnd };
      }
      
      // Move to after this block
      nextStart = new Date(block.endTime);
    }
    
    // Check if we can fit after all blocks
    const finalEnd = new Date(nextStart.getTime() + duration * 60000);
    if (finalEnd <= endOfDay) {
      return { start: nextStart, end: finalEnd };
    }
    
    return null;
  }

  private isSlotAvailable(startTime: Date, endTime: Date, excludeTaskId?: string): boolean {
    return !this.schedule.some(block => {
      if (excludeTaskId && block.taskId === excludeTaskId) return false;
      return this.timeSlotsOverlap(startTime, endTime, block.startTime, block.endTime);
    });
  }

  private timeSlotsOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  // Round date up to the nearest N-minute mark
  private roundUpToMinutes(date: Date, minutes: number): Date {
    const ms = minutes * 60000;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
  }

  private regenerateSchedule() {
    // Don't auto-regenerate here - let the caller control when to generate
    // This prevents issues with date mismatches
  }
  
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private regenerateBreaks() {
    // Remove existing breaks and regenerate them
    this.schedule = this.schedule.filter(b => b.type !== 'break');
    
    // Sort task blocks by time
    const taskBlocks = this.schedule
      .filter(b => b.type === 'task')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Insert breaks between tasks based on work intensity
    for (let i = 0; i < taskBlocks.length - 1; i++) {
      const currentTask = taskBlocks[i];
      const nextTask = taskBlocks[i + 1];
      
      const gapDuration = (nextTask.startTime.getTime() - currentTask.endTime.getTime()) / 60000;
      const workDuration = currentTask.task?.duration || 0;
      
      // Add break if gap is sufficient and work duration warrants it
      if (gapDuration >= this.config.shortBreakDuration && workDuration >= 60) {
        const breakDuration = workDuration >= this.config.longBreakThreshold 
          ? Math.min(this.config.longBreakDuration, gapDuration)
          : Math.min(this.config.shortBreakDuration, gapDuration);
        
        this.schedule.push({
          id: `break-${currentTask.endTime.getTime()}`,
          type: 'break',
          startTime: new Date(currentTask.endTime),
          endTime: new Date(currentTask.endTime.getTime() + breakDuration * 60000),
          title: breakDuration === this.config.longBreakDuration ? 'Long Break' : 'Short Break',
          description: 'Time to recharge and stay productive'
        });
      }
    }
  }
}
