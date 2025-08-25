import { useState, useMemo } from 'react';
import { Task, ScheduleBlock } from '@/types/task';
import { AITaskScheduler } from '@/lib/scheduler';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskForm from '@/components/TaskForm';
import TaskList from '@/components/TaskList';
import ScheduleTimeline from '@/components/ScheduleTimeline';
import { Brain, Calendar, CheckSquare, Plus, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('ai-scheduler-tasks', []);
  const [schedule, setSchedule] = useLocalStorage<ScheduleBlock[]>('ai-scheduler-schedule', []);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const scheduler = useMemo(() => new AITaskScheduler(), []);

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
              
              <Button 
                onClick={generateSchedule}
                disabled={incompleteTasks.length === 0}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Schedule
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

          <TabsContent value="schedule" className="space-y-6">
            <ScheduleTimeline schedule={schedule} />
            
            {schedule.length === 0 && (
              <Card className="p-8 text-center bg-gradient-card border-border shadow-card">
                <Brain className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Schedule Generated Yet</h3>
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
                  Generate Schedule
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}