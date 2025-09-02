'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameDay, isSameMonth, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { TaskWithDetails } from '@/lib/types'
import type { Habit } from '@/hooks/useHabits'

interface MonthlyCalendarProps {
  tasks: TaskWithDetails[]
  habits?: Habit[]
  onDateSelect?: (date: Date) => void
  selectedDate?: Date
  showHabits?: boolean
  className?: string
}

interface CalendarDay {
  date: Date
  tasks: TaskWithDetails[]
  habitTasks: TaskWithDetails[]
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

interface HabitDetailDialogProps {
  habit: Habit | null
  isOpen: boolean
  onClose: () => void
}

function HabitDetailDialog({ habit, isOpen, onClose }: HabitDetailDialogProps) {
  if (!habit) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Circle className="h-5 w-5" />
            {habit.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {habit.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
              <p className="text-sm">{habit.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Priority</h4>
              <Badge variant={habit.priority === 'high' ? 'destructive' : habit.priority === 'normal' ? 'default' : 'secondary'}>
                {habit.priority}
              </Badge>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Status</h4>
              <Badge variant={habit.is_active ? 'default' : 'secondary'}>
                {habit.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Frequency</h4>
            <p className="text-sm">
              {habit.recurrence_rule.type === 'daily' && `Daily${habit.recurrence_rule.interval > 1 ? ` (every ${habit.recurrence_rule.interval} days)` : ''}`}
              {habit.recurrence_rule.type === 'weekly' && `Weekly${habit.recurrence_rule.interval > 1 ? ` (every ${habit.recurrence_rule.interval} weeks)` : ''}`}
              {habit.recurrence_rule.type === 'monthly' && `Monthly${habit.recurrence_rule.interval > 1 ? ` (every ${habit.recurrence_rule.interval} months)` : ''}`}
              {habit.recurrence_rule.type === 'custom' && 'Custom schedule'}
            </p>
            {habit.recurrence_rule.days_of_week && habit.recurrence_rule.days_of_week.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                On {habit.recurrence_rule.days_of_week.join(', ')}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Created {format(parseISO(habit.created_at), 'MMM d, yyyy')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function MonthlyCalendar({ 
  tasks, 
  habits = [], 
  onDateSelect, 
  selectedDate, 
  showHabits = false, 
  className 
}: MonthlyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null)
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    content: { title: string; time: string; isCompleted: boolean }[]
    x: number
    y: number
  }>({
    visible: false,
    content: [],
    x: 0,
    y: 0
  })
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Adjust tooltip position if it goes off-screen
  useEffect(() => {
    if (tooltip.visible && tooltipRef.current) {
      const tooltipEl = tooltipRef.current
      const rect = tooltipEl.getBoundingClientRect()
      
      // Adjust horizontal position if tooltip goes off-screen
      let adjustedX = tooltip.x
      if (rect.left < 10) {
        adjustedX = rect.width / 2 + 10
      } else if (rect.right > window.innerWidth - 10) {
        adjustedX = window.innerWidth - rect.width / 2 - 10
      }
      
      // Adjust vertical position if tooltip goes off-screen  
      let adjustedY = tooltip.y
      if (rect.top < 10) {
        adjustedY = tooltip.y + 80 // Move below the date cell
      }
      
      if (adjustedX !== tooltip.x || adjustedY !== tooltip.y) {
        setTooltip(prev => ({ ...prev, x: adjustedX, y: adjustedY }))
      }
    }
  }, [tooltip.visible, tooltip.x, tooltip.y])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    return days.map(date => {
      const dayTasks = tasks.filter(task => {
        const taskDate = task.due_date ? parseISO(task.due_date) : 
                        task.assigned_date ? parseISO(task.assigned_date) : null
        return taskDate && isSameDay(taskDate, date)
      })

      const habitTasks = showHabits ? dayTasks.filter(task => task.habit_id) : []
      const regularTasks = showHabits ? dayTasks.filter(task => !task.habit_id) : dayTasks

      return {
        date,
        tasks: regularTasks,
        habitTasks,
        isCurrentMonth: isSameMonth(date, currentDate),
        isToday: isToday(date),
        isSelected: selectedDate ? isSameDay(date, selectedDate) : false
      } as CalendarDay
    })
  }, [currentDate, tasks, selectedDate, showHabits])

  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1))
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1))
  const goToToday = () => setCurrentDate(new Date())

  const handleDateClick = (date: Date) => {
    onDateSelect?.(date)
  }

  const handleHabitClick = (habitId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const habit = habits.find(h => h.id === habitId)
    if (habit) {
      setSelectedHabit(habit)
    }
  }

  const handleMouseEnter = (day: CalendarDay, event: React.MouseEvent) => {
    const dayTasks = showHabits ? [...day.tasks, ...day.habitTasks] : day.tasks
    
    if (dayTasks.length > 0 && day.isCurrentMonth) {
      const rect = event.currentTarget.getBoundingClientRect()
      const taskData = dayTasks.map(task => {
        const title = task.title || 'Untitled Task'
        const isCompleted = task.status === 'completed'
        let time = ''
        
        // Check for reminder time first, then due date time
        if (task.reminder_time) {
          try {
            const reminderDate = new Date(task.reminder_time)
            time = reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } catch (e) {
            // If reminder_time parsing fails, continue without time
          }
        } else if (task.due_date) {
          try {
            const dueDate = new Date(task.due_date)
            // Only show time if it's not midnight (meaning a specific time was set)
            if (dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0) {
              time = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          } catch (e) {
            // If due_date parsing fails, continue without time
          }
        }
        
        return { title, time, isCompleted }
      })
      
      setTooltip({
        visible: true,
        content: taskData,
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      })
    }
  }

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }

  const monthYear = format(currentDate, 'MMMM yyyy')
  const weekDayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {monthYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDayHeaders.map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const totalItems = showHabits ? day.tasks.length + day.habitTasks.length : day.tasks.length
              const completedItems = showHabits 
                ? [...day.tasks, ...day.habitTasks].filter(task => task.status === 'completed').length
                : day.tasks.filter(task => task.status === 'completed').length

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day.date)}
                  onMouseEnter={(e) => handleMouseEnter(day, e)}
                  onMouseLeave={handleMouseLeave}
                  className={cn(
                    "relative p-2 min-h-[80px] rounded-lg border transition-all hover:border-primary/50 text-left",
                    day.isCurrentMonth 
                      ? "bg-background border-border" 
                      : "bg-muted/30 border-muted text-muted-foreground",
                    day.isSelected && "ring-2 ring-primary ring-offset-2",
                    day.isToday && "bg-primary/5 border-primary/30",
                    totalItems > 0 && day.isCurrentMonth && "hover:shadow-md"
                  )}
                >
                  {/* Date number */}
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    day.isToday && day.isCurrentMonth && "text-primary",
                    !day.isCurrentMonth && "text-muted-foreground"
                  )}>
                    {format(day.date, 'd')}
                  </div>

                  {/* Task indicators */}
                  {day.isCurrentMonth && (
                    <div className="space-y-1">
                      {/* Regular tasks */}
                      {day.tasks.length > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-blue-600 truncate">
                              {day.tasks.length} task{day.tasks.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          {day.tasks.some(task => task.status === 'completed') && (
                            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      )}

                      {/* Habit tasks */}
                      {showHabits && day.habitTasks.length > 0 && (
                        <div className="space-y-1">
                          {day.habitTasks.slice(0, 2).map(habitTask => {
                            const habit = habits.find(h => h.id === habitTask.habit_id)
                            return (
                              <button
                                key={habitTask.id}
                                onClick={(e) => habit && handleHabitClick(habit.id, e)}
                                className="flex items-center gap-1 w-full text-left hover:bg-accent/50 rounded px-1 py-0.5"
                              >
                                <Circle className={cn(
                                  "h-2 w-2 flex-shrink-0",
                                  habitTask.status === 'completed' ? "text-green-500" : "text-orange-500"
                                )} />
                                <span className={cn(
                                  "text-xs text-orange-700 truncate",
                                  habitTask.status === 'completed' && "line-through text-muted-foreground"
                                )}>
                                  {habit?.title}
                                </span>
                                {habitTask.status === 'completed' && (
                                  <CheckCircle2 className="h-2 w-2 text-green-500 flex-shrink-0" />
                                )}
                              </button>
                            )
                          })}
                          {day.habitTasks.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{day.habitTasks.length - 2} more
                            </div>
                          )}
                        </div>
                      )}

                      {/* Completion summary */}
                      {totalItems > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {completedItems}/{totalItems} done
                        </div>
                      )}
                    </div>
                  )}

                  {/* Today indicator */}
                  {day.isToday && (
                    <div className="absolute top-1 right-1">
                      <div className="h-2 w-2 bg-primary rounded-full"></div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <HabitDetailDialog
        habit={selectedHabit}
        isOpen={!!selectedHabit}
        onClose={() => setSelectedHabit(null)}
      />
      
      {/* Task Tooltip */}
      {tooltip.visible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 bg-white text-black text-sm rounded-lg shadow-lg border border-black pointer-events-none max-w-xs"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          <div className="space-y-1">
            {tooltip.content.map((taskData, index) => (
              <div key={index} className="flex items-center justify-between gap-3 min-w-0">
                <div className={cn(
                  "truncate flex-1",
                  taskData.isCompleted && "line-through text-gray-500"
                )}>
                  • {taskData.title}
                </div>
                {taskData.time && (
                  <div className={cn(
                    "text-xs font-mono shrink-0",
                    taskData.isCompleted ? "text-gray-500" : "text-gray-600"
                  )}>
                    {taskData.time}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Tooltip arrow */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid black'
            }}
          />
        </div>
      )}
    </>
  )
}