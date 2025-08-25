import React, { useState } from 'react';
import { UnavailableBlock } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Clock, Trash2, Repeat, Calendar } from 'lucide-react';

interface UnavailableTimeManagerProps {
  unavailableBlocks: UnavailableBlock[];
  onAddBlock: (block: Omit<UnavailableBlock, 'id'>) => void;
  onDeleteBlock: (blockId: string) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export default function UnavailableTimeManager({ 
  unavailableBlocks, 
  onAddBlock, 
  onDeleteBlock 
}: UnavailableTimeManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    recurring: false,
    recurringType: 'weekly' as 'daily' | 'weekly',
    selectedDays: [] as number[]
  });

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startTime || !form.endTime) return;

    const startTime = new Date(`2000-01-01T${form.startTime}:00`);
    const endTime = new Date(`2000-01-01T${form.endTime}:00`);

    const newBlock: Omit<UnavailableBlock, 'id'> = {
      startTime,
      endTime,
      title: form.title,
      description: form.description || undefined,
      recurring: form.recurring ? {
        type: form.recurringType,
        days: form.recurringType === 'weekly' ? form.selectedDays : undefined
      } : undefined
    };

    onAddBlock(newBlock);
    setIsOpen(false);
    setForm({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      recurring: false,
      recurringType: 'weekly',
      selectedDays: []
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatRecurring = (block: UnavailableBlock) => {
    if (!block.recurring) return 'One-time';
    
    if (block.recurring.type === 'daily') return 'Daily';
    
    if (block.recurring.type === 'weekly' && block.recurring.days) {
      const dayNames = block.recurring.days
        .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label.slice(0, 3))
        .join(', ');
      return `Weekly (${dayNames})`;
    }
    
    return 'Weekly';
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day].sort()
    }));
  };

  return (
    <Card className="p-6 bg-gradient-card border-border shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Unavailable Times</h3>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-primary hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add Block
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Unavailable Time</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="block-title">Title</Label>
                <Input
                  id="block-title"
                  placeholder="e.g., Sleep, Classes, Meetings"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add details..."
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={form.recurring}
                    onCheckedChange={(checked) => 
                      setForm(prev => ({ ...prev, recurring: !!checked }))
                    }
                  />
                  <Label htmlFor="recurring" className="flex items-center gap-1">
                    <Repeat className="w-4 h-4" />
                    Recurring
                  </Label>
                </div>
                
                {form.recurring && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <Label>Frequency</Label>
                      <Select
                        value={form.recurringType}
                        onValueChange={(value: 'daily' | 'weekly') => 
                          setForm(prev => ({ ...prev, recurringType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {form.recurringType === 'weekly' && (
                      <div>
                        <Label>Days of Week</Label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {DAYS_OF_WEEK.map(day => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`day-${day.value}`}
                                checked={form.selectedDays.includes(day.value)}
                                onCheckedChange={() => toggleDay(day.value)}
                              />
                              <Label 
                                htmlFor={`day-${day.value}`}
                                className="text-sm"
                              >
                                {day.label.slice(0, 3)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || !form.startTime || !form.endTime}
                  className="flex-1"
                >
                  Add Block
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="space-y-3">
        {unavailableBlocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No unavailable times set</p>
            <p className="text-sm">Add blocks for sleep, classes, or meetings</p>
          </div>
        ) : (
          unavailableBlocks.map(block => (
            <div 
              key={block.id}
              className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground">{block.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {formatRecurring(block)}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  {block.description && (
                    <span className="ml-2">• {block.description}</span>
                  )}
                </div>
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDeleteBlock(block.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}