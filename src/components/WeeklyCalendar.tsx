'use client'

import React, { useMemo, useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle, Clock, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewEntryForm } from '@/components/NewEntryForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from '@/lib/utils'
import type { TaskWithDetails } from '@/lib/types'
import type { Habit } from '@/hooks/useHabits'

interface WeeklyCalendarProps {
  tasks: TaskWithDetails[]
  habits: Habit[]
  className?: string
  onTaskUpdate?: () => void
}

interface CalendarDay {
  date: Date
  tasks: TaskWithDetails[]
  habitTasks: TaskWithDetails[]
  isToday: boolean
}

interface TaskPopoverProps {
  task: TaskWithDetails
  habit?: Habit
  onEdit: () => void
}

function TaskPopover({ task, habit, onEdit }: TaskPopoverProps) {
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'destructive'
      case 'low':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'on_deck':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="w-80 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{task.title}</h3>
          {habit && (
            <p className="text-sm text-orange-600 mt-1">
              From habit: {habit.title}
            </p>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onEdit}
          className="ml-2 shrink-0"
        >
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      {task.description && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
          <p className="text-sm">{task.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Status</h4>
          <Badge className={getStatusColor(task.status || 'on_deck')}>
            {task.status || 'on_deck'}
          </Badge>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Priority</h4>
          <Badge variant={getPriorityColor(task.priority)}>
            {task.priority || 'normal'}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {task.due_date && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
          </div>
        )}
        {task.assigned_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Assigned: {format(parseISO(task.assigned_date), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Created {format(parseISO(task.created_at), 'MMM d, yyyy')}
      </div>
    </div>
  )
}

export function WeeklyCalendar({ tasks = [], habits = [], className, onTaskUpdate }: WeeklyCalendarProps) {
  const [currentWeek, setCurrentWeek] = React.useState(new Date())
  const [taskToEdit, setTaskToEdit] = React.useState<TaskWithDetails | null>(null)
  
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
    
    return days.map(date => {
      const dayTasks = tasks.filter(task => {
        const taskDate = task.due_date ? parseISO(task.due_date) : 
                        task.assigned_date ? parseISO(task.assigned_date) : null
        return taskDate && isSameDay(taskDate, date)
      })
      
      const habitTasks = dayTasks.filter(task => task.habit_id)
      const regularTasks = dayTasks.filter(task => !task.habit_id)
      
      return {
        date,
        tasks: regularTasks,
        habitTasks,
        isToday: isToday(date)
      } as CalendarDay
    })
  }, [currentWeek, tasks])
  
  const goToPreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1))
  const goToNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1))
  const goToCurrentWeek = () => setCurrentWeek(new Date())
  
  const weekRange = `${format(weekDays[0].date, 'MMM d')} - ${format(weekDays[6].date, 'MMM d, yyyy')}`
  
  return (
    <>
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{weekRange}</span>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const totalTasks = day.tasks.length + day.habitTasks.length
            const completedTasks = [...day.tasks, ...day.habitTasks].filter(t => t.status === 'completed').length
            
            return (
              <div
                key={index}
                className={cn(
                  "relative min-h-[140px] p-3 rounded-lg border transition-all flex flex-col",
                  day.isToday 
                    ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                    : "bg-background border-border hover:border-primary/20",
                )}
              >
                {/* Day header */}
                <div className="mb-2">
                  <div className={cn(
                    "text-xs font-medium",
                    day.isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {format(day.date, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold",
                    day.isToday && "text-primary"
                  )}>
                    {format(day.date, 'd')}
                  </div>
                </div>
                
                {/* Task previews */}
                <div className="space-y-1 flex-1">
                  {/* Regular tasks */}
                  {day.tasks.map((task) => (
                    <Popover key={task.id}>
                      <PopoverTrigger asChild>
                        <button 
                          className="w-full text-left hover:bg-accent/50 rounded p-1 transition-colors"
                          title={task.title}
                        >
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className={cn(
                              "h-3 w-3 flex-shrink-0",
                              task.status === 'completed' ? "text-green-500" : "text-blue-500"
                            )} />
                            <span className={cn(
                              "text-xs truncate flex-1",
                              task.status === 'completed' && "line-through text-muted-foreground"
                            )}>
                              {task.title}
                            </span>
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4" align="start">
                        <TaskPopover task={task} onEdit={() => setTaskToEdit(task)} />
                      </PopoverContent>
                    </Popover>
                  ))}
                  
                  {/* Habit tasks */}
                  {day.habitTasks.map((habitTask) => {
                    const habit = habits.find(h => h.id === habitTask.habit_id)
                    return (
                      <Popover key={habitTask.id}>
                        <PopoverTrigger asChild>
                          <button 
                            className="w-full text-left hover:bg-accent/50 rounded p-1 transition-colors"
                            title={habitTask.title}
                          >
                            <div className="flex items-center gap-1">
                              <Circle className={cn(
                                "h-3 w-3 flex-shrink-0",
                                habitTask.status === 'completed' ? "text-green-500" : "text-orange-500"
                              )} />
                              <span className={cn(
                                "text-xs text-orange-700 truncate flex-1",
                                habitTask.status === 'completed' && "line-through text-muted-foreground"
                              )}>
                                {habitTask.title}
                              </span>
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="start">
                          <TaskPopover task={habitTask} habit={habit} onEdit={() => setTaskToEdit(habitTask)} />
                        </PopoverContent>
                      </Popover>
                    )
                  })}
                  
                  {totalTasks === 0 && (
                    <div className="text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                  
                  {/* Progress indicator */}
                  {totalTasks > 0 && (
                    <div className="mt-2 pt-1">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {completedTasks}/{totalTasks}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Today indicator dot */}
                {day.isToday && (
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Week summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">
                  {weekDays.reduce((sum, day) => sum + day.tasks.length, 0)} tasks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">
                  {weekDays.reduce((sum, day) => sum + day.habitTasks.length, 0)} habits
                </span>
              </div>
            </div>
            <div className="text-muted-foreground">
              {weekDays.reduce((sum, day) => 
                sum + [...day.tasks, ...day.habitTasks].filter(t => t.status === 'completed').length, 0
              )} completed this week
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    
    {/* Edit Task Form */}
    {taskToEdit && (
      <NewEntryForm
        initialData={taskToEdit}
        isEditing={true}
        onEntryCreated={() => {
          onTaskUpdate?.();
          setTaskToEdit(null);
        }}
        onClose={() => setTaskToEdit(null)}
      />
    )}
  </>
  )
}