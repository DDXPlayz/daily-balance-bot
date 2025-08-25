import { Task, TimeBlock, UnavailableBlock, Priority, BlockType } from '@/types/task';

export class TimetableScheduler {
  private tasks: Task[] = [];
  private unavailableBlocks: UnavailableBlock[] = [];
  private dayStart = 6; // 6 AM
  private dayEnd = 23; // 11 PM
  private shortBreakDuration = 15; // minutes
  private longBreakDuration = 30; // minutes
  private maxContinuousWork = 90; // minutes

  setTasks(tasks: Task[]) {
    this.tasks = tasks.filter(task => !task.completed);
  }

  setUnavailableBlocks(blocks: UnavailableBlock[]) {
    this.unavailableBlocks = blocks;
  }

  generateTimetable(date: Date = new Date()): TimeBlock[] {
    const timetable: TimeBlock[] = [];
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Add unavailable blocks for the day
    this.addUnavailableBlocks(timetable, targetDate);

    // Sort tasks by priority and deadline
    const sortedTasks = this.prioritizeTasks();

    // Place tasks in available slots
    this.placeTasks(timetable, sortedTasks, targetDate);

    // Add breaks between work sessions
    this.insertBreaks(timetable);

    return timetable.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  private addUnavailableBlocks(timetable: TimeBlock[], date: Date) {
    this.unavailableBlocks.forEach(block => {
      const blockDate = new Date(date);
      const startTime = new Date(block.startTime);
      const endTime = new Date(block.endTime);

      // Check if this block applies to the target date
      if (this.shouldIncludeBlock(block, date)) {
        blockDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        const blockEndTime = new Date(blockDate);
        blockEndTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

        timetable.push({
          id: `unavailable-${block.id}-${date.toDateString()}`,
          type: 'unavailable',
          startTime: blockDate,
          endTime: blockEndTime,
          title: block.title,
          description: block.description,
          isFixed: true
        });
      }
    });
  }

  private shouldIncludeBlock(block: UnavailableBlock, date: Date): boolean {
    if (!block.recurring) return true;

    if (block.recurring.type === 'daily') return true;
    
    if (block.recurring.type === 'weekly') {
      const dayOfWeek = date.getDay();
      return block.recurring.days?.includes(dayOfWeek) ?? false;
    }

    return true;
  }

  private placeTasks(timetable: TimeBlock[], tasks: Task[], date: Date) {
    for (const task of tasks) {
      const slot = this.findAvailableSlot(timetable, task.duration, date);
      if (slot) {
        const taskBlock: TimeBlock = {
          id: `task-${task.id}`,
          type: 'task',
          taskId: task.id,
          task: { ...task, scheduledTime: slot.start },
          startTime: slot.start,
          endTime: slot.end,
          title: task.name,
          description: `${task.type} • ${task.priority} priority • ${task.duration}m`
        };
        timetable.push(taskBlock);
      }
    }
  }

  private findAvailableSlot(timetable: TimeBlock[], duration: number, date: Date): { start: Date; end: Date } | null {
    const dayStart = new Date(date);
    dayStart.setHours(this.dayStart, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(this.dayEnd, 0, 0, 0);

    // Create time slots (30-minute intervals)
    const slots: { start: Date; end: Date; available: boolean }[] = [];
    const current = new Date(dayStart);

    while (current < dayEnd) {
      const slotEnd = new Date(current.getTime() + 30 * 60000);
      slots.push({
        start: new Date(current),
        end: slotEnd,
        available: true
      });
      current.setTime(current.getTime() + 30 * 60000);
    }

    // Mark unavailable slots
    timetable.forEach(block => {
      slots.forEach(slot => {
        if (this.slotsOverlap(slot.start, slot.end, block.startTime, block.endTime)) {
          slot.available = false;
        }
      });
    });

    // Find consecutive available slots for task duration
    const requiredSlots = Math.ceil(duration / 30);
    for (let i = 0; i <= slots.length - requiredSlots; i++) {
      const consecutiveSlots = slots.slice(i, i + requiredSlots);
      if (consecutiveSlots.every(slot => slot.available)) {
        return {
          start: consecutiveSlots[0].start,
          end: consecutiveSlots[consecutiveSlots.length - 1].end
        };
      }
    }

    return null;
  }

  private slotsOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  private insertBreaks(timetable: TimeBlock[]) {
    const taskBlocks = timetable.filter(block => block.type === 'task')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const breaksToAdd: TimeBlock[] = [];
    let continuousWorkTime = 0;

    for (let i = 0; i < taskBlocks.length - 1; i++) {
      const currentTask = taskBlocks[i];
      const nextTask = taskBlocks[i + 1];
      
      continuousWorkTime += currentTask.task?.duration || 0;

      // Check if we need a break before the next task
      const timeBetween = nextTask.startTime.getTime() - currentTask.endTime.getTime();
      const needsBreak = continuousWorkTime >= this.maxContinuousWork || timeBetween >= 15 * 60000;

      if (needsBreak && timeBetween >= 15 * 60000) {
        const breakDuration = continuousWorkTime >= 120 ? this.longBreakDuration : this.shortBreakDuration;
        const breakEnd = new Date(currentTask.endTime.getTime() + breakDuration * 60000);

        if (breakEnd <= nextTask.startTime) {
          breaksToAdd.push({
            id: `break-${currentTask.id}-${nextTask.id}`,
            type: 'break',
            startTime: new Date(currentTask.endTime),
            endTime: breakEnd,
            title: breakDuration === this.longBreakDuration ? 'Long Break' : 'Short Break',
            description: 'Time to recharge'
          });
          
          if (breakDuration === this.longBreakDuration) {
            continuousWorkTime = 0;
          }
        }
      }
    }

    timetable.push(...breaksToAdd);
  }

  private prioritizeTasks(): Task[] {
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

  rescheduleTask(taskId: string, newStartTime: Date, timetable: TimeBlock[]): TimeBlock[] {
    const taskIndex = timetable.findIndex(block => block.taskId === taskId);
    if (taskIndex === -1) return timetable;

    const taskBlock = timetable[taskIndex];
    const duration = taskBlock.endTime.getTime() - taskBlock.startTime.getTime();
    const newEndTime = new Date(newStartTime.getTime() + duration);

    // Check if new time slot is available
    const conflictExists = timetable.some((block, index) => 
      index !== taskIndex && 
      this.slotsOverlap(newStartTime, newEndTime, block.startTime, block.endTime)
    );

    if (!conflictExists) {
      const updatedTimetable = [...timetable];
      updatedTimetable[taskIndex] = {
        ...taskBlock,
        startTime: newStartTime,
        endTime: newEndTime,
        task: taskBlock.task ? { ...taskBlock.task, scheduledTime: newStartTime } : undefined
      };
      return updatedTimetable;
    }

    return timetable;
  }

  addUnavailableTime(startTime: Date, endTime: Date, title: string, description?: string): UnavailableBlock {
    const newBlock: UnavailableBlock = {
      id: crypto.randomUUID(),
      startTime,
      endTime,
      title,
      description
    };
    
    this.unavailableBlocks.push(newBlock);
    return newBlock;
  }
}