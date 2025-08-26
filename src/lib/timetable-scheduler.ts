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
    
    const now = new Date();
    const isToday = targetDate.toDateString() === now.toDateString();

    // Add unavailable blocks for the specific day only
    this.addUnavailableBlocks(timetable, targetDate);

    // Sort tasks by priority and deadline, filter out completed and past due
    const sortedTasks = this.prioritizeTasks(targetDate, isToday ? now : null);

    // Place tasks in available slots
    this.placeTasks(timetable, sortedTasks, targetDate, isToday ? now : null);

    // Add intelligent breaks between work sessions
    this.insertIntelligentBreaks(timetable);

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
    // Check if block is for this specific date
    const blockDate = new Date(block.startTime);
    const targetDate = new Date(date);
    
    // If not recurring, only include if it's the same date
    if (!block.recurring) {
      return blockDate.toDateString() === targetDate.toDateString();
    }

    if (block.recurring.type === 'daily') return true;
    
    if (block.recurring.type === 'weekly') {
      const dayOfWeek = date.getDay();
      return block.recurring.days?.includes(dayOfWeek) ?? false;
    }

    return false;
  }

  private placeTasks(timetable: TimeBlock[], tasks: Task[], date: Date, currentTime?: Date | null) {
    let lastTaskEndTime: Date | null = null;
    let continuousWorkTime = 0;
    
    for (const task of tasks) {
      const slot = this.findAvailableSlot(timetable, task.duration, date, currentTime, lastTaskEndTime, continuousWorkTime);
      if (slot) {
        const taskBlock: TimeBlock = {
          id: `task-${task.id}-${date.toDateString()}`,
          type: 'task',
          taskId: task.id,
          task: { ...task, scheduledTime: slot.start },
          startTime: slot.start,
          endTime: slot.end,
          title: task.name,
          description: `${task.type} • ${task.priority} priority • ${task.duration}m`
        };
        timetable.push(taskBlock);
        lastTaskEndTime = slot.end;
        continuousWorkTime += task.duration;
        
        // Reset continuous work time after breaks
        if (continuousWorkTime > this.maxContinuousWork) {
          continuousWorkTime = 0;
        }
      }
    }
  }

  private findAvailableSlot(
    timetable: TimeBlock[], 
    duration: number, 
    date: Date, 
    currentTime?: Date | null,
    lastTaskEndTime?: Date | null,
    continuousWorkTime?: number
  ): { start: Date; end: Date } | null {
    const now = currentTime || new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const dayStart = new Date(date);
    dayStart.setHours(this.dayStart, 0, 0, 0);
    
    // If today, start from current time (rounded up to next 30min slot)
    if (isToday && now > dayStart) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const roundedMinute = currentMinute > 30 ? 60 : currentMinute > 0 ? 30 : 0;
      if (roundedMinute === 60) {
        dayStart.setHours(currentHour + 1, 0, 0, 0);
      } else {
        dayStart.setHours(currentHour, roundedMinute, 0, 0);
      }
    }
    
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

    // Find consecutive available slots for task duration, respecting breaks
    const requiredSlots = Math.ceil(duration / 30);
    
    for (let i = 0; i <= slots.length - requiredSlots; i++) {
      const consecutiveSlots = slots.slice(i, i + requiredSlots);
      
      if (consecutiveSlots.every(slot => slot.available)) {
        const proposedStart = consecutiveSlots[0].start;
        
        // Check if we need a break before this task
        if (lastTaskEndTime && continuousWorkTime && continuousWorkTime >= this.maxContinuousWork) {
          const timeSinceLastTask = proposedStart.getTime() - lastTaskEndTime.getTime();
          const minBreakTime = continuousWorkTime >= 120 ? this.longBreakDuration : this.shortBreakDuration;
          
          if (timeSinceLastTask < minBreakTime * 60000) {
            continue; // Skip this slot, need more break time
          }
        }
        
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

  private insertIntelligentBreaks(timetable: TimeBlock[]) {
    const taskBlocks = timetable.filter(block => block.type === 'task')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const breaksToAdd: TimeBlock[] = [];
    let continuousWorkTime = 0;

    for (let i = 0; i < taskBlocks.length - 1; i++) {
      const currentTask = taskBlocks[i];
      const nextTask = taskBlocks[i + 1];
      
      const taskDuration = currentTask.task?.duration || 0;
      continuousWorkTime += taskDuration;

      // Calculate time gap between tasks
      const timeBetween = nextTask.startTime.getTime() - currentTask.endTime.getTime();
      const minutesBetween = timeBetween / (1000 * 60);

      // Determine if break is needed
      const needsShortBreak = taskDuration >= 45 && minutesBetween >= this.shortBreakDuration;
      const needsLongBreak = continuousWorkTime >= this.maxContinuousWork && minutesBetween >= this.longBreakDuration;
      
      // Avoid scheduling intensive tasks back-to-back
      const currentIntensive = currentTask.task?.priority === 'high' || (currentTask.task?.duration || 0) >= 90;
      const nextIntensive = nextTask.task?.priority === 'high' || (nextTask.task?.duration || 0) >= 90;
      const needsRestBreak = currentIntensive && nextIntensive && minutesBetween >= this.shortBreakDuration;

      if ((needsLongBreak || needsRestBreak || needsShortBreak) && minutesBetween >= this.shortBreakDuration) {
        const breakDuration = needsLongBreak ? this.longBreakDuration : this.shortBreakDuration;
        const breakEnd = new Date(currentTask.endTime.getTime() + breakDuration * 60000);

        if (breakEnd <= nextTask.startTime) {
          const breakType = needsLongBreak ? 'Extended Break' : needsRestBreak ? 'Rest Break' : 'Short Break';
          
          breaksToAdd.push({
            id: `break-${currentTask.id}-${nextTask.id}`,
            type: 'break',
            startTime: new Date(currentTask.endTime),
            endTime: breakEnd,
            title: breakType,
            description: needsLongBreak ? 'Extended rest for wellbeing' : needsRestBreak ? 'Recovery from intensive work' : 'Quick refresh'
          });
          
          // Reset continuous work time after long breaks
          if (needsLongBreak) {
            continuousWorkTime = 0;
          }
        }
      }
      
      // Reset continuous work time if there's a natural long gap
      if (minutesBetween >= 60) {
        continuousWorkTime = 0;
      }
    }

    timetable.push(...breaksToAdd);
  }

  private prioritizeTasks(targetDate: Date, currentTime?: Date | null): Task[] {
    const now = currentTime || new Date();
    const isToday = targetDate.toDateString() === now.toDateString();
    
    return [...this.tasks]
      .filter(task => {
        // Only include tasks that should be scheduled for this specific date
        const taskDate = new Date(task.deadline);
        const daysDiff = Math.ceil((taskDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Include tasks due today or within reasonable scheduling window
        return daysDiff >= 0 || (daysDiff >= -1 && !task.completed);
      })
      .sort((a, b) => {
        const getBalancedScore = (task: Task) => {
          const timeToDeadline = task.deadline.getTime() - now.getTime();
          const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
          
          let score = 0;
          
          // Deadline urgency (0-80) - reduced from 100 for better balance
          if (hoursToDeadline <= 24) score += 80;
          else if (hoursToDeadline <= 48) score += 60;
          else if (hoursToDeadline <= 168) score += 40;
          else score += 15;
          
          // Priority weight (0-40) - reduced for balance
          if (task.priority === 'high') score += 40;
          else if (task.priority === 'medium') score += 25;
          else score += 10;
          
          // Task type balance (0-15)
          if (task.type === 'work') score += 15;
          else if (task.type === 'study') score += 12;
          else score += 8; // Leisure gets reasonable priority
          
          // Wellbeing factor - reduce score for very long tasks to spread them out
          if (task.duration > 120) score -= 10;
          if (task.duration > 180) score -= 15;
          
          return score;
        };
        
        return getBalancedScore(b) - getBalancedScore(a);
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