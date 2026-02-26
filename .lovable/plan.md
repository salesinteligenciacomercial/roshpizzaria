

## Plan: Visual Kanban/Google Calendar View for Agenda

### What changes
Replace the right-side "Compromissos do dia" card in the "Visão Geral" tab with a Google Calendar-style weekly timeline view showing appointments as colored blocks with title, time, and description.

### Implementation Steps

1. **Create `AgendaWeekView` component** (`src/components/agenda/AgendaWeekView.tsx`)
   - Weekly timeline grid (7 columns for days, rows for hours 7AM-8PM)
   - Appointments rendered as colored blocks positioned by start time and sized by duration
   - Color coding by status: blue = agendado, green = concluído, red = cancelado
   - Each block shows: title, time range, patient/lead name
   - Click on block opens existing edit dialog
   - Current time indicator (red line like Google Calendar)

2. **Create `AgendaDayView` component** (`src/components/agenda/AgendaDayView.tsx`)
   - Single day expanded timeline view (taller slots, more detail per block)
   - Reuses same color scheme and block rendering
   - Shows more detail: observações, profissional, etc.

3. **Update `src/pages/Agenda.tsx` "Visão Geral" tab**
   - Replace the right-side Card (compromissos do dia list) with a toggle: Day View / Week View
   - Keep the calendar on the left as-is (it's the date picker)
   - Import and render the new components, passing `compromissosDoMes`, `selectedDate`, and action handlers (edit, delete, status change)
   - Keep all existing functionality (status badges, duplicate, retorno, edit, delete buttons) accessible via click/popover on each block

### Technical Details
- No database changes needed
- No new dependencies — pure CSS grid positioning for the timeline
- Block position: `top = (startHour - 7) * hourHeight`, `height = durationMinutes / 60 * hourHeight`
- Status colors map: `{ agendado: 'bg-blue-500', concluido: 'bg-green-500', cancelado: 'bg-red-500', confirmado: 'bg-emerald-500' }`
- Week view columns derived from `eachDayOfInterval` around `selectedDate`

