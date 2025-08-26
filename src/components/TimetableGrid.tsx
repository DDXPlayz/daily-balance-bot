import React, { useState, useRef, useEffect } from 'react';
import { TimeBlock, UnavailableBlock } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Plus, GripVertical, X, Calendar, Users, Coffee, Briefcase, BookOpen, Gamepad2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimetableGridProps {
  timetable: TimeBlock[];
  onRescheduleTask: (taskId: string, newStartTime: Date) => void;
  onAddUnavailableTime: (startTime: Date, endTime: Date, title: string, description?: string) => void;
  onDeleteTimeBlock: (blockId: string) => void;
  selectedDate: Date;
}

export default function TimetableGrid({ 
  timetable, 
  onRescheduleTask, 
  onAddUnavailableTime,
  onDeleteTimeBlock,
  selectedDate 
}: TimetableGridProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ hour: number; minute: number } | null>(null);
  const [bookingForm, setBookingForm] = useState({ title: '', description: '', duration: 60 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  // Update current time every minute for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const isToday = selectedDate.toDateString() === currentTime.toDateString();

  // Generate time slots (30-minute intervals from 6 AM to 11 PM)
  const timeSlots = [];
  for (let hour = 6; hour <= 23; hour++) {
    timeSlots.push({ hour, minute: 0 });
    if (hour < 23) timeSlots.push({ hour, minute: 30 });
  }

  const formatTime = (hour: number, minute: number) => {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: minute === 0 ? undefined : '2-digit',
      hour12: true 
    });
  };

  const getBlocksForSlot = (hour: number, minute: number) => {
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    
    return timetable.filter(block => {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      return blockStart <= slotTime && blockEnd > slotTime;
    });
  };

  const getBlockIcon = (block: TimeBlock) => {
    switch (block.type) {
      case 'task':
        switch (block.task?.type) {
          case 'work': return <Briefcase className="w-3 h-3" />;
          case 'study': return <BookOpen className="w-3 h-3" />;
          case 'leisure': return <Gamepad2 className="w-3 h-3" />;
          default: return <Clock className="w-3 h-3" />;
        }
      case 'break': return <Coffee className="w-3 h-3" />;
      case 'unavailable': return <Ban className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const getBlockColor = (block: TimeBlock) => {
    switch (block.type) {
      case 'task':
        switch (block.task?.priority) {
          case 'high': return 'bg-destructive/20 border-destructive text-destructive-foreground';
          case 'medium': return 'bg-warning/20 border-warning text-warning-foreground';
          case 'low': return 'bg-success/20 border-success text-success-foreground';
          default: return 'bg-primary/20 border-primary text-primary-foreground';
        }
      case 'break': return 'bg-accent/30 border-accent text-accent-foreground';
      case 'unavailable': return 'bg-muted border-muted-foreground text-muted-foreground';
      default: return 'bg-secondary/20 border-secondary text-secondary-foreground';
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (timetable.find(b => b.taskId === taskId)?.isFixed) return;
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, hour: number, minute: number) => {
    e.preventDefault();
    if (!draggedTask) return;

    const newStartTime = new Date(selectedDate);
    newStartTime.setHours(hour, minute, 0, 0);
    
    onRescheduleTask(draggedTask, newStartTime);
    setDraggedTask(null);
  };

  const handleSlotClick = (hour: number, minute: number) => {
    const blocks = getBlocksForSlot(hour, minute);
    
    // Don't allow booking past time slots if it's today
    if (isToday) {
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hour, minute, 0, 0);
      if (slotTime <= currentTime) {
        return; // Don't allow booking past times
      }
    }
    
    if (blocks.length === 0) {
      setSelectedSlot({ hour, minute });
    }
  };

  const isSlotInPast = (hour: number, minute: number) => {
    if (!isToday) return false;
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    return slotTime <= currentTime;
  };

  const isCurrentTimeSlot = (hour: number, minute: number) => {
    if (!isToday) return false;
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(slotTime.getTime() + 30 * 60000);
    return currentTime >= slotTime && currentTime < slotEnd;
  };

  // Auto-scroll to keep current slot at top
  const currentSlotKey = React.useMemo(() => {
    if (!isToday) return null;
    for (const { hour, minute } of timeSlots) {
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotTime.getTime() + 30 * 60000);
      if (currentTime >= slotTime && currentTime < slotEnd) {
        return `${hour}-${minute}`;
      }
    }
    return null;
  }, [currentTime, isToday, selectedDate]);

  const prevSlotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isToday || !currentSlotKey) return;
    if (prevSlotKeyRef.current === currentSlotKey) return;
    prevSlotKeyRef.current = currentSlotKey;

    // Scroll the grid so the current slot is at the top
    requestAnimationFrame(() => {
      const el = document.getElementById(`slot-${currentSlotKey}`);
      if (el && gridRef.current) {
        gridRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    });
  }, [currentSlotKey, isToday]);

  const handleBookTime = () => {
    if (!selectedSlot) return;
    
    const startTime = new Date(selectedDate);
    startTime.setHours(selectedSlot.hour, selectedSlot.minute, 0, 0);
    
    const endTime = new Date(startTime.getTime() + bookingForm.duration * 60000);
    
    onAddUnavailableTime(startTime, endTime, bookingForm.title, bookingForm.description);
    setSelectedSlot(null);
    setBookingForm({ title: '', description: '', duration: 60 });
  };

  const getSlotHeight = (block: TimeBlock) => {
    const duration = block.endTime.getTime() - block.startTime.getTime();
    const minutes = duration / (1000 * 60);
    return Math.max(32, (minutes / 30) * 40); // 40px per 30-minute slot, minimum 32px
  };

  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary/20 border border-primary rounded-sm"></div>
              Tasks
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-accent/30 border border-accent rounded-sm"></div>
              Breaks
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-muted border border-muted-foreground rounded-sm"></div>
              Unavailable
            </span>
          </div>
        </div>
      </div>

      <div 
        ref={gridRef}
        className="max-h-[600px] overflow-y-auto bg-background/50"
      >
        {timeSlots.map(({ hour, minute }) => {
          const blocks = getBlocksForSlot(hour, minute);
          const isEmpty = blocks.length === 0;
          const isPast = isSlotInPast(hour, minute);
          const isCurrent = isCurrentTimeSlot(hour, minute);
          
          return (
            <div
              id={`slot-${hour}-${minute}`}
              key={`${hour}-${minute}`}
              className={cn(
                "flex border-b border-border/30 transition-colors overflow-hidden",
                "h-10 md:h-12",
                minute === 0 && "border-t border-border",
                isEmpty && !isPast && "hover:bg-accent/5 cursor-pointer",
                isPast && "bg-muted/30 text-muted-foreground/50",
                isCurrent && "bg-primary/10 border-primary/30",
                isPast && "pointer-events-none"
              )}
              onDragOver={!isPast ? handleDragOver : undefined}
              onDrop={!isPast ? (e) => handleDrop(e, hour, minute) : undefined}
              onClick={!isPast ? () => handleSlotClick(hour, minute) : undefined}
            >
              {/* Time column */}
              <div className={cn(
                "w-16 md:w-20 p-2 bg-muted/20 border-r border-border text-xs md:text-sm font-mono flex items-center",
                isPast && "text-muted-foreground/40",
                isCurrent && "bg-primary/20 text-primary-foreground font-semibold"
              )}>
                {minute === 0 && (
                  <span className={cn(isCurrent && "animate-pulse")}>
                    {formatTime(hour, minute)}
                    {isCurrent && " ●"}
                  </span>
                )}
              </div>
              
              {/* Content column */}
              <div className="flex-1 p-1 relative overflow-hidden">
                {isEmpty ? (
                  <div className={cn(
                    "h-full flex items-center justify-center text-xs md:text-sm transition-colors",
                    isPast ? "text-muted-foreground/30" : "text-muted-foreground/50 hover:text-muted-foreground",
                    !isPast && "cursor-pointer"
                  )}>
                    {isPast ? "Past" : "Click to book time"}
                  </div>
                ) : (
                  <div className="h-full">
                    {blocks.map(block => (
                      <div
                        key={block.id}
                        draggable={block.type === 'task' && !block.isFixed}
                        onDragStart={(e) => block.taskId && handleDragStart(e, block.taskId)}
                        className={cn(
                          "relative group rounded-md border p-1 md:p-2 text-xs md:text-sm transition-all duration-200 h-full overflow-hidden",
                          getBlockColor(block),
                          block.type === 'task' && !block.isFixed && "cursor-move hover:scale-[1.02] hover:shadow-sm",
                          draggedTask === block.taskId && "opacity-50 scale-95",
                          isPast && "opacity-60"
                        )}
                        style={{ height: '100%' }}
                      >
                        <div className="flex items-start gap-2">
                          {block.type === 'task' && !block.isFixed && (
                            <GripVertical className="w-3 h-3 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                          )}
                          
                          {getBlockIcon(block)}
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{block.title}</div>
                            {block.description && (
                              <div className="text-xs opacity-75 truncate mt-0.5">
                                {block.description}
                              </div>
                            )}
                          </div>
                          
                          {block.task && (
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <Badge 
                                variant={block.task.priority === 'high' ? 'destructive' : 'secondary'}
                                className="text-xs px-1 py-0"
                              >
                                {block.task.priority}
                              </Badge>
                            </div>
                          )}
                          
                          {(block.type === 'unavailable' || (block.type === 'task' && !block.isFixed)) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0 hover:bg-destructive/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTimeBlock(block.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Book Time Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Unavailable Time</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="time-slot">Selected Time</Label>
              <Input
                id="time-slot"
                value={selectedSlot ? formatTime(selectedSlot.hour, selectedSlot.minute) : ''}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Meeting, Class, Sleep"
                value={bookingForm.title}
                onChange={(e) => setBookingForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={bookingForm.duration}
                onChange={(e) => setBookingForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add details about this time block..."
                value={bookingForm.description}
                onChange={(e) => setBookingForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleBookTime}
                disabled={!bookingForm.title.trim()}
                className="flex-1"
              >
                Book Time
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedSlot(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}