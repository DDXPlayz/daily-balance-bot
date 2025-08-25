import { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, Flag, Trash2 } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export default function TaskList({ tasks, onToggleComplete, onDeleteTask }: TaskListProps) {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-accent text-accent-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: Task['type']) => {
    switch (type) {
      case 'work': return 'bg-primary text-primary-foreground';
      case 'study': return 'bg-secondary text-secondary-foreground';
      case 'leisure': return 'bg-gradient-success text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDeadline = (deadline: Date) => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 0) return 'Overdue';
    if (hours < 24) return `${hours}h remaining`;
    const days = Math.floor(hours / 24);
    return `${days}d remaining`;
  };

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center bg-gradient-card border-border shadow-card">
        <p className="text-muted-foreground">No tasks yet. Add your first task to get started!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card 
          key={task.id} 
          className={`p-4 transition-all duration-200 bg-gradient-card border-border shadow-card hover:shadow-glow ${
            task.completed ? 'opacity-60' : ''
          }`}
        >
          <div className="flex items-start gap-4">
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => onToggleComplete(task.id)}
              className="mt-1"
            />
            
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className={`font-semibold ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {task.name}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteTask(task.id)}
                  className="text-muted-foreground hover:text-destructive p-1 h-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {task.duration}m
                </div>
                
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {formatDeadline(task.deadline)}
                </div>
                
                <Badge className={getPriorityColor(task.priority)}>
                  <Flag className="w-3 h-3 mr-1" />
                  {task.priority}
                </Badge>
                
                <Badge className={getTypeColor(task.type)}>
                  {task.type}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}