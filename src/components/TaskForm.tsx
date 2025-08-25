import { useState } from 'react';
import { Task, TaskType, Priority } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Calendar, Clock, Flag, Briefcase } from 'lucide-react';

interface TaskFormProps {
  onSubmit: (task: Omit<Task, 'id' | 'completed' | 'createdAt'>) => void;
}

export default function TaskForm({ onSubmit }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    deadline: '',
    priority: '' as Priority,
    type: '' as TaskType
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.duration || !formData.deadline || !formData.priority || !formData.type) {
      return;
    }

    const task = {
      name: formData.name,
      duration: parseInt(formData.duration),
      deadline: new Date(formData.deadline),
      priority: formData.priority,
      type: formData.type
    };

    onSubmit(task);
    setFormData({
      name: '',
      duration: '',
      deadline: '',
      priority: '' as Priority,
      type: '' as TaskType
    });
  };

  return (
    <Card className="p-6 bg-gradient-card border-border shadow-card">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2 text-foreground">
            <Briefcase className="w-4 h-4 text-primary" />
            Task Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Enter your task..."
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-background/50 border-border"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              placeholder="60"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="bg-background/50 border-border"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline" className="flex items-center gap-2 text-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              Deadline
            </Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="bg-background/50 border-border"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <Flag className="w-4 h-4 text-primary" />
              Priority
            </Label>
            <Select value={formData.priority} onValueChange={(value: Priority) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <Briefcase className="w-4 h-4 text-primary" />
              Type
            </Label>
            <Select value={formData.type} onValueChange={(value: TaskType) => setFormData({ ...formData, type: value })}>
              <SelectTrigger className="bg-background/50 border-border">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="study">Study</SelectItem>
                <SelectItem value="leisure">Leisure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 transition-opacity">
          Add Task
        </Button>
      </form>
    </Card>
  );
}