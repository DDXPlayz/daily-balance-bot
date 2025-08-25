import { useState, useMemo } from 'react';
import { Task, ScheduleBlock, TimeBlock, UnavailableBlock } from '@/types/task';
import { AITaskScheduler } from '@/lib/scheduler';
import { TimetableScheduler } from '@/lib/timetable-scheduler';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskForm from '@/components/TaskForm';
import TaskList from '@/components/TaskList';
import ScheduleTimeline from '@/components/ScheduleTimeline';
import TimetableGrid from '@/components/TimetableGrid';
import UnavailableTimeManager from '@/components/UnavailableTimeManager';
import { Brain, Calendar, CheckSquare, Plus, Sparkles, Grid3X3, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('ai-scheduler-tasks', []);
  const [schedule, setSchedule] = useLocalStorage<ScheduleBlock[]>('ai-scheduler-schedule', []);
  const [timetable, setTimetable] = useLocalStorage<TimeBlock[]>('ai-scheduler-timetable', []);
  const [unavailableBlocks, setUnavailableBlocks] = useLocalStorage<UnavailableBlock[]>('ai-scheduler-unavailable', []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const scheduler = useMemo(() => new AITaskScheduler(), []);
  const timetableScheduler = useMemo(() => new TimetableScheduler(), []);

  const addTask = (taskData: Omit<Task, 'id' | 'completed' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      completed: false,
      createdAt: new Date()
    };
    
    setTasks(prev => [...prev, newTask]);
    toast({
      title: "Task added!",
      description: `"${newTask.name}" has been added to your task list.`,
    });
  };

  const toggleTaskComplete = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      toast({
        title: task.completed ? "Task unmarked" : "Task completed!",
        description: `"${task.name}" has been ${task.completed ? 'unmarked' : 'marked as complete'}.`,
      });
    }
  };

  const deleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.filter(task => task.id !== taskId));
    
    if (task) {
      toast({
        title: "Task deleted",
        description: `"${task.name}" has been removed from your list.`,
        variant: "destructive"
      });
    }
  };

  const generateSchedule = () => {
    scheduler.setTasks(tasks);
    const newSchedule = scheduler.generateSchedule();
    setSchedule(newSchedule);
    
    toast({
      title: "Schedule generated!",
      description: `Your AI-optimized schedule with ${newSchedule.filter(b => b.type === 'task').length} tasks is ready.`,
    });
    
    setActiveTab('schedule');
  };

  const generateTimetable = () => {
    timetableScheduler.setTasks(tasks);
    timetableScheduler.setUnavailableBlocks(unavailableBlocks);
    const newTimetable = timetableScheduler.generateTimetable(selectedDate);
    setTimetable(newTimetable);
    
    toast({
      title: "Timetable generated!",
      description: `Your hour-by-hour schedule for ${selectedDate.toLocaleDateString()} is ready.`,
    });
    
    setActiveTab('timetable');
  };

  const handleRescheduleTask = (taskId: string, newStartTime: Date) => {
    const newTimetable = timetableScheduler.rescheduleTask(taskId, newStartTime, timetable);
    setTimetable(newTimetable);
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      toast({
        title: "Task rescheduled",
        description: `"${task.name}" moved to ${newStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`,
      });
    }
  };

  const handleAddUnavailableTime = (startTime: Date, endTime: Date, title: string, description?: string) => {
    const newBlock = timetableScheduler.addUnavailableTime(startTime, endTime, title, description);
    setUnavailableBlocks(prev => [...prev, newBlock]);
    
    toast({
      title: "Time blocked",
      description: `"${title}" added to unavailable times.`,
    });
    
    // Regenerate timetable if there are scheduled tasks
    if (timetable.length > 0) {
      generateTimetable();
    }
  };

  const handleAddUnavailableBlock = (block: Omit<UnavailableBlock, 'id'>) => {
    const newBlock: UnavailableBlock = {
      ...block,
      id: crypto.randomUUID()
    };
    setUnavailableBlocks(prev => [...prev, newBlock]);
    
    toast({
      title: "Unavailable time added",
      description: `"${block.title}" has been added to your unavailable times.`,
    });
  };

  const handleDeleteUnavailableBlock = (blockId: string) => {
    const block = unavailableBlocks.find(b => b.id === blockId);
    setUnavailableBlocks(prev => prev.filter(b => b.id !== blockId));
    
    if (block) {
      toast({
        title: "Time block removed",
        description: `"${block.title}" has been deleted.`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteTimeBlock = (blockId: string) => {
    const block = timetable.find(b => b.id === blockId);
    
    if (block?.type === 'unavailable') {
      // Remove from unavailable blocks
      setUnavailableBlocks(prev => prev.filter(b => `unavailable-${b.id}-${selectedDate.toDateString()}` !== blockId));
    } else {
      // Remove from timetable
      setTimetable(prev => prev.filter(b => b.id !== blockId));
    }
    
    if (block) {
      toast({
        title: "Block removed",
        description: `"${block.title}" has been removed from the schedule.`,
        variant: "destructive"
      });
    }
  };

  const incompleteTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Task Scheduler</h1>
                <p className="text-sm text-muted-foreground">Intelligent productivity planning</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <p className="text-foreground font-medium">{incompleteTasks.length} pending</p>
                <p className="text-muted-foreground">{completedTasks.length} completed</p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={generateSchedule}
                  disabled={incompleteTasks.length === 0}
                  size="sm"
                  variant="outline"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
                
                <Button 
                  onClick={generateTimetable}
                  disabled={incompleteTasks.length === 0}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Timetable
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="timetable" className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" />
              Timetable
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="blocks" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Blocks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Stats */}
              <Card className="p-6 bg-gradient-card border-border shadow-card">
                <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Tasks</span>
                    <span className="font-semibold text-foreground">{tasks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-semibold text-foreground">{incompleteTasks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-semibold text-foreground">{completedTasks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated Time</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(incompleteTasks.reduce((sum, task) => sum + task.duration, 0) / 60 * 10) / 10}h
                    </span>
                  </div>
                </div>
              </Card>

              {/* Add Task */}
              <Card className="p-6 bg-gradient-card border-border shadow-card">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Quick Add Task
                </h3>
                <TaskForm onSubmit={addTask} />
              </Card>
            </div>

            {/* Recent Tasks */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Tasks</h3>
              <TaskList 
                tasks={tasks.slice(-3)} 
                onToggleComplete={toggleTaskComplete}
                onDeleteTask={deleteTask}
              />
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-semibold text-foreground mb-4">Add New Task</h3>
                <TaskForm onSubmit={addTask} />
              </div>
              
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold text-foreground mb-4">Your Tasks</h3>
                <TaskList 
                  tasks={tasks} 
                  onToggleComplete={toggleTaskComplete}
                  onDeleteTask={deleteTask}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timetable" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3">
                <TimetableGrid
                  timetable={timetable}
                  selectedDate={selectedDate}
                  onRescheduleTask={handleRescheduleTask}
                  onAddUnavailableTime={handleAddUnavailableTime}
                  onDeleteTimeBlock={handleDeleteTimeBlock}
                />
              </div>
              
              <div className="space-y-4">
                <Card className="p-4 bg-gradient-card border-border shadow-card">
                  <h4 className="font-semibold text-foreground mb-3">Date Selection</h4>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                      className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                    />
                    <Button 
                      onClick={generateTimetable}
                      disabled={incompleteTasks.length === 0}
                      className="w-full bg-gradient-primary hover:opacity-90"
                    >
                      <Grid3X3 className="w-4 h-4 mr-2" />
                      Generate Timetable
                    </Button>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-card border-border shadow-card">
                  <h4 className="font-semibold text-foreground mb-3">Quick Stats</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tasks scheduled:</span>
                      <span className="font-medium text-foreground">
                        {timetable.filter(b => b.type === 'task').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Break time:</span>
                      <span className="font-medium text-foreground">
                        {Math.round(timetable.filter(b => b.type === 'break')
                          .reduce((total, b) => total + (b.endTime.getTime() - b.startTime.getTime()), 0) / (1000 * 60))}m
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unavailable:</span>
                      <span className="font-medium text-foreground">
                        {timetable.filter(b => b.type === 'unavailable').length} blocks
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
            
            {timetable.length === 0 && (
              <Card className="p-8 text-center bg-gradient-card border-border shadow-card">
                <Grid3X3 className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Timetable Generated Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Set up your unavailable times and generate a timetable to see your optimized daily schedule.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => setActiveTab('blocks')}
                    variant="outline"
                  >
                    Set Time Blocks
                  </Button>
                  <Button 
                    onClick={generateTimetable}
                    disabled={incompleteTasks.length === 0}
                    className="bg-gradient-primary hover:opacity-90 transition-opacity"
                  >
                    <Grid3X3 className="w-4 h-4 mr-2" />
                    Generate Timetable
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <ScheduleTimeline schedule={schedule} />
            
            {schedule.length === 0 && (
              <Card className="p-8 text-center bg-gradient-card border-border shadow-card">
                <Brain className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Timeline Generated Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add some tasks and click "Generate Schedule" to see your AI-optimized timeline.
                </p>
                <Button 
                  onClick={() => setActiveTab('tasks')}
                  variant="outline"
                  className="mr-2"
                >
                  Add Tasks
                </Button>
                <Button 
                  onClick={generateSchedule}
                  disabled={incompleteTasks.length === 0}
                  className="bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Timeline
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="blocks" className="space-y-6">
            <UnavailableTimeManager
              unavailableBlocks={unavailableBlocks}
              onAddBlock={handleAddUnavailableBlock}
              onDeleteBlock={handleDeleteUnavailableBlock}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}