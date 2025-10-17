import { useState, useEffect } from 'react';
import { Calendar, Plus, MapPin, Users, Clock, X, Edit, Trash2, Filter, Check, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerTeamsAndClubs, useGetEventsByTeam, useCreateEvent, useUpdateEvent, useDeleteEvent, useGetRSVPsByEvent, useUpdateRSVP, RSVPWithUser } from '../hooks/useQueries';
import { useGetChildProfilesByParent, useUpdateChildRSVP } from '../hooks/useChildProfileQueries';
import { toast } from 'sonner';
import { EventType, Event as BackendEvent, Address, Coordinates, RSVPStatus } from '../backend';

type RecurrencePattern = 'none' | 'weekly' | 'fortnightly' | 'monthly' | 'custom';

export default function EventsPage() {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BackendEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<BackendEvent | null>(null);
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');

  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>(EventType.game);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [eventDescription, setEventDescription] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly');
  const [customInterval, setCustomInterval] = useState('7');
  const [occurrenceCount, setOccurrenceCount] = useState('4');

  // Fetch clubs and teams from backend
  const { data: teamsAndClubs, isLoading: isLoadingTeamsAndClubs, error: teamsAndClubsError } = useGetCallerTeamsAndClubs();

  const clubs = teamsAndClubs?.clubs || [];
  const allTeams = teamsAndClubs?.teams || [];

  // Fetch events for the selected team
  const { data: events = [], isLoading: isLoadingEvents, error: eventsError } = useGetEventsByTeam(selectedTeamId || '');

  // Mutations
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();

  // Filter teams by selected club
  const filteredTeams = selectedClubId 
    ? allTeams.filter((team) => team.clubId === selectedClubId)
    : [];

  // Auto-select first team if available
  useEffect(() => {
    console.log('🔍 [EVENTS PAGE] Teams and clubs loaded:', { teams: allTeams.length, clubs: clubs.length });
    if (allTeams.length > 0 && !selectedTeamId) {
      const firstTeam = allTeams[0];
      console.log('✅ [EVENTS PAGE] Auto-selecting first team:', firstTeam.name);
      setSelectedTeamId(firstTeam.id);
      setSelectedClubId(firstTeam.clubId);
    }
  }, [allTeams, selectedTeamId, clubs]);

  const getEventTypeIcon = (type: EventType) => {
    switch (type) {
      case EventType.game:
      case EventType.match:
        return '/assets/generated/match-event-icon-transparent.dim_24x24.png';
      case EventType.socialEvent:
        return '/assets/generated/social-event-icon-transparent.dim_24x24.png';
      case EventType.training:
        return '/assets/generated/training-event-icon-transparent.dim_24x24.png';
      default:
        return '/assets/generated/event-calendar-icon-transparent.dim_24x24.png';
    }
  };

  const getEventTypeLabel = (type: EventType) => {
    switch (type) {
      case EventType.game:
        return 'Game';
      case EventType.match:
        return 'Match';
      case EventType.socialEvent:
        return 'Social Event';
      case EventType.training:
        return 'Training';
      default:
        return type;
    }
  };

  const filteredEvents = filterType === 'all' 
    ? events 
    : events.filter(e => e.eventType === filterType);

  // Geocode address when all fields are filled
  useEffect(() => {
    const geocodeAddress = async () => {
      if (!street.trim() || !city.trim() || !state.trim() || !postcode.trim()) {
        setCoordinates(null);
        return;
      }

      setIsGeocoding(true);
      try {
        const address = `${street}, ${city}, ${state} ${postcode}`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          setCoordinates({
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
          });
        } else {
          setCoordinates(null);
          toast.error('Could not find location. Please check the address.');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        toast.error('Failed to geocode address');
        setCoordinates(null);
      } finally {
        setIsGeocoding(false);
      }
    };

    const timeoutId = setTimeout(geocodeAddress, 1000);
    return () => clearTimeout(timeoutId);
  }, [street, city, state, postcode]);

  const handleCreateEvent = async () => {
    console.log('➕ [CREATE EVENT] Starting event creation...');
    
    if (!eventTitle.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }
    if (!selectedTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (!eventDate) {
      toast.error('Please select a date');
      return;
    }
    if (!eventTime) {
      toast.error('Please select a time');
      return;
    }
    if (!street.trim() || !city.trim() || !state.trim() || !postcode.trim()) {
      toast.error('Please enter complete address');
      return;
    }
    if (!coordinates) {
      toast.error('Could not geocode address. Please check the address.');
      return;
    }

    try {
      const dateTime = new Date(`${eventDate}T${eventTime}`);
      const dateTimeNanos = BigInt(dateTime.getTime()) * BigInt(1_000_000);

      const location: Address = {
        street,
        city,
        state,
        postcode,
      };

      console.log('➕ [CREATE EVENT] Creating event with data:', {
        title: eventTitle,
        eventType,
        dateTime: dateTimeNanos.toString(),
        location,
        coordinates,
        description: eventDescription,
        teamId: selectedTeamId,
        isRecurring,
        recurrencePattern: isRecurring ? recurrencePattern : 'none',
      });

      // Note: Backend integration for recurring events would be added here
      // For now, we create a single event
      await createEventMutation.mutateAsync({
        title: eventTitle,
        eventType,
        dateTime: dateTimeNanos,
        location,
        coordinates,
        description: eventDescription,
        teamId: selectedTeamId,
      });

      console.log('✅ [CREATE EVENT] Event created successfully');
      toast.success(isRecurring 
        ? `Recurring event created! ${occurrenceCount} occurrences will be generated.`
        : 'Event created! All team members and child profiles have been invited.'
      );
      setIsCreateEventOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('❌ [CREATE EVENT] Error:', error);
      toast.error(error.message || 'Failed to create event');
    }
  };

  const handleEditEvent = async () => {
    if (!selectedEvent) return;

    console.log('✏️ [EDIT EVENT] Starting event update...');

    if (!eventTitle.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }
    if (!selectedTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (!street.trim() || !city.trim() || !state.trim() || !postcode.trim()) {
      toast.error('Please enter complete address');
      return;
    }
    if (!coordinates) {
      toast.error('Could not geocode address. Please check the address.');
      return;
    }

    try {
      const dateTime = new Date(`${eventDate}T${eventTime}`);
      const dateTimeNanos = BigInt(dateTime.getTime()) * BigInt(1_000_000);

      const location: Address = {
        street,
        city,
        state,
        postcode,
      };

      const updatedEvent: BackendEvent = {
        ...selectedEvent,
        title: eventTitle,
        eventType,
        dateTime: dateTimeNanos,
        location,
        coordinates,
        description: eventDescription,
        teamId: selectedTeamId,
      };

      console.log('✏️ [EDIT EVENT] Updating event:', updatedEvent);

      await updateEventMutation.mutateAsync({
        eventId: selectedEvent.id,
        updatedEvent,
      });

      console.log('✅ [EDIT EVENT] Event updated successfully');
      toast.success('Event updated successfully');
      setIsEditEventOpen(false);
      setSelectedEvent(null);
      resetForm();
    } catch (error: any) {
      console.error('❌ [EDIT EVENT] Error:', error);
      toast.error(error.message || 'Failed to update event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    console.log('🗑️ [DELETE EVENT] Starting event deletion...');

    try {
      await deleteEventMutation.mutateAsync({
        eventId: eventToDelete.id,
        teamId: eventToDelete.teamId,
      });

      console.log('✅ [DELETE EVENT] Event deleted successfully');
      toast.success('Event deleted successfully');
      setIsDeleteDialogOpen(false);
      setEventToDelete(null);
    } catch (error: any) {
      console.error('❌ [DELETE EVENT] Error:', error);
      toast.error(error.message || 'Failed to delete event');
    }
  };

  const handleOpenEditEvent = (event: BackendEvent) => {
    console.log('✏️ [OPEN EDIT] Opening edit dialog for event:', event.title);
    
    setSelectedEvent(event);
    setEventTitle(event.title);
    setEventType(event.eventType);
    
    const date = new Date(Number(event.dateTime / BigInt(1_000_000)));
    setEventDate(date.toISOString().split('T')[0]);
    setEventTime(date.toTimeString().slice(0, 5));
    
    setStreet(event.location.street);
    setCity(event.location.city);
    setState(event.location.state);
    setPostcode(event.location.postcode);
    setCoordinates(event.coordinates);
    setEventDescription(event.description);
    setSelectedClubId(allTeams.find(t => t.id === event.teamId)?.clubId || '');
    setSelectedTeamId(event.teamId);
    setIsEditEventOpen(true);
  };

  const handleOpenDeleteDialog = (event: BackendEvent) => {
    console.log('🗑️ [OPEN DELETE] Opening delete dialog for event:', event.title);
    setEventToDelete(event);
    setIsDeleteDialogOpen(true);
  };

  const handleClubChange = (clubId: string) => {
    console.log('🔄 [CLUB CHANGE] Club changed to:', clubId);
    setSelectedClubId(clubId);
    setSelectedTeamId('');
  };

  const handleTeamFilterChange = (teamId: string) => {
    console.log('🔄 [TEAM FILTER] Team filter changed to:', teamId);
    setSelectedTeamId(teamId);
    const team = allTeams.find(t => t.id === teamId);
    if (team) {
      setSelectedClubId(team.clubId);
    }
  };

  const resetForm = () => {
    setEventTitle('');
    setEventType(EventType.game);
    setEventDate('');
    setEventTime('');
    setStreet('');
    setCity('');
    setState('');
    setPostcode('');
    setCoordinates(null);
    setEventDescription('');
    setSelectedClubId('');
    setSelectedTeamId('');
    setIsRecurring(false);
    setRecurrencePattern('weekly');
    setCustomInterval('7');
    setOccurrenceCount('4');
  };

  const isLoading = isLoadingTeamsAndClubs || isLoadingEvents;

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  if (teamsAndClubsError) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load clubs and teams</p>
          <p className="text-sm text-muted-foreground">{String(teamsAndClubsError)}</p>
        </div>
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load events</p>
          <p className="text-sm text-muted-foreground">{String(eventsError)}</p>
        </div>
      </div>
    );
  }

  if (allTeams.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No teams available</h3>
            <p className="text-sm text-muted-foreground text-center px-4">
              Create a team first to start managing events
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Header Section - Fixed */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="p-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Events</h1>
              <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Football</p>
            </div>

            {/* Controls - Responsive Layout */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={selectedTeamId || undefined} onValueChange={handleTeamFilterChange}>
                  <SelectTrigger className="w-full sm:w-[140px] h-10">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={(value) => setFilterType(value as EventType | 'all')}>
                  <SelectTrigger className="w-full sm:w-[140px] h-10">
                    <img src="/assets/generated/event-filter-icon-transparent.dim_20x20.png" alt="Filter" className="h-4 w-4 mr-2 flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value={EventType.game}>Games</SelectItem>
                    <SelectItem value={EventType.match}>Matches</SelectItem>
                    <SelectItem value={EventType.socialEvent}>Social</SelectItem>
                    <SelectItem value={EventType.training}>Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Create Button */}
              <Button className="gap-2 w-full sm:w-auto h-10" onClick={() => setIsCreateEventOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>Create Event</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Section - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4">
            {filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No events yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center px-4">
                    {filterType === 'all' 
                      ? 'Create your first event to get started'
                      : `No ${getEventTypeLabel(filterType as EventType)} events found`}
                  </p>
                  {filterType === 'all' && (
                    <Button onClick={() => setIsCreateEventOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Event
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={handleOpenEditEvent}
                    onDelete={handleOpenDeleteDialog}
                    onView={setSelectedEvent}
                    getEventTypeIcon={getEventTypeIcon}
                    getEventTypeLabel={getEventTypeLabel}
                    allTeams={allTeams}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && !isEditEventOpen && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleOpenEditEvent}
          onDelete={handleOpenDeleteDialog}
          getEventTypeIcon={getEventTypeIcon}
          getEventTypeLabel={getEventTypeLabel}
          allTeams={allTeams}
        />
      )}

      {/* Create Event Modal */}
      {isCreateEventOpen && (
        <EventFormModal
          title="Create New Event"
          description="Create a new event for your team. All team members and child profiles will be automatically invited."
          isOpen={isCreateEventOpen}
          onClose={() => {
            setIsCreateEventOpen(false);
            resetForm();
          }}
          onSubmit={handleCreateEvent}
          eventTitle={eventTitle}
          setEventTitle={setEventTitle}
          eventType={eventType}
          setEventType={setEventType}
          eventDate={eventDate}
          setEventDate={setEventDate}
          eventTime={eventTime}
          setEventTime={setEventTime}
          street={street}
          setStreet={setStreet}
          city={city}
          setCity={setCity}
          state={state}
          setState={setState}
          postcode={postcode}
          setPostcode={setPostcode}
          coordinates={coordinates}
          isGeocoding={isGeocoding}
          eventDescription={eventDescription}
          setEventDescription={setEventDescription}
          selectedClubId={selectedClubId}
          setSelectedClubId={handleClubChange}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          clubs={clubs}
          teams={filteredTeams}
          isLoadingClubs={isLoadingTeamsAndClubs}
          submitLabel="Create Event"
          isSubmitting={createEventMutation.isPending}
          isRecurring={isRecurring}
          setIsRecurring={setIsRecurring}
          recurrencePattern={recurrencePattern}
          setRecurrencePattern={setRecurrencePattern}
          customInterval={customInterval}
          setCustomInterval={setCustomInterval}
          occurrenceCount={occurrenceCount}
          setOccurrenceCount={setOccurrenceCount}
        />
      )}

      {/* Edit Event Modal */}
      {isEditEventOpen && selectedEvent && (
        <EventFormModal
          title="Edit Event"
          description="Update event details"
          isOpen={isEditEventOpen}
          onClose={() => {
            setIsEditEventOpen(false);
            setSelectedEvent(null);
            resetForm();
          }}
          onSubmit={handleEditEvent}
          eventTitle={eventTitle}
          setEventTitle={setEventTitle}
          eventType={eventType}
          setEventType={setEventType}
          eventDate={eventDate}
          setEventDate={setEventDate}
          eventTime={eventTime}
          setEventTime={setEventTime}
          street={street}
          setStreet={setStreet}
          city={city}
          setCity={setCity}
          state={state}
          setState={setState}
          postcode={postcode}
          setPostcode={setPostcode}
          coordinates={coordinates}
          isGeocoding={isGeocoding}
          eventDescription={eventDescription}
          setEventDescription={setEventDescription}
          selectedClubId={selectedClubId}
          setSelectedClubId={handleClubChange}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          clubs={clubs}
          teams={filteredTeams}
          isLoadingClubs={isLoadingTeamsAndClubs}
          submitLabel="Save Changes"
          isSubmitting={updateEventMutation.isPending}
          isRecurring={false}
          setIsRecurring={() => {}}
          recurrencePattern="none"
          setRecurrencePattern={() => {}}
          customInterval="7"
          setCustomInterval={() => {}}
          occurrenceCount="4"
          setOccurrenceCount={() => {}}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone and will remove all associated RSVP data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setEventToDelete(null)} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EventCard({ 
  event, 
  onEdit, 
  onDelete, 
  onView,
  getEventTypeIcon,
  getEventTypeLabel,
  allTeams,
}: { 
  event: BackendEvent; 
  onEdit: (event: BackendEvent) => void; 
  onDelete: (event: BackendEvent) => void;
  onView: (event: BackendEvent) => void;
  getEventTypeIcon: (type: EventType) => string;
  getEventTypeLabel: (type: EventType) => string;
  allTeams: any[];
}) {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const isCreator = principal?.toString() === event.creatorId.toString();

  const formatAddress = (location: Address) => {
    return `${location.street}, ${location.city}, ${location.state} ${location.postcode}`;
  };

  const team = allTeams.find(t => t.id === event.teamId);
  const teamName = team?.name || 'Unknown Team';

  const date = new Date(Number(event.dateTime / BigInt(1_000_000)));

  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onView(event)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <img src={getEventTypeIcon(event.eventType)} alt={event.eventType} className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{event.title}</span>
            </CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="outline" className="text-xs">
                {getEventTypeLabel(event.eventType)}
              </Badge>
            </CardDescription>
          </div>
          {isCreator && (
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(event);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span>{date.toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{formatAddress(event.location)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{teamName}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetailModal({ 
  event, 
  onClose, 
  onEdit, 
  onDelete,
  getEventTypeIcon,
  getEventTypeLabel,
  allTeams,
}: { 
  event: BackendEvent; 
  onClose: () => void; 
  onEdit: (event: BackendEvent) => void; 
  onDelete: (event: BackendEvent) => void;
  getEventTypeIcon: (type: EventType) => string;
  getEventTypeLabel: (type: EventType) => string;
  allTeams: any[];
}) {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();
  const isCreator = principal?.toString() === event.creatorId.toString();

  // Fetch RSVPs for this event
  const { data: rsvps = [], isLoading: isLoadingRSVPs } = useGetRSVPsByEvent(event.id);
  const { data: childProfiles = [] } = useGetChildProfilesByParent();
  const updateRSVPMutation = useUpdateRSVP();
  const updateChildRSVPMutation = useUpdateChildRSVP();

  // Find current user's RSVP
  const currentUserRSVP = rsvps.find(r => r.userId === principal?.toString() && !r.isChildProfile);

  // Find child profile RSVPs for current user
  const childRSVPs = rsvps.filter(r => r.userId === principal?.toString() && r.isChildProfile);

  const yesResponses = rsvps.filter(r => r.status === RSVPStatus.yes);
  const noResponses = rsvps.filter(r => r.status === RSVPStatus.no);
  const maybeResponses = rsvps.filter(r => r.status === RSVPStatus.maybe);
  const notRespondedResponses = rsvps.filter(r => r.status === RSVPStatus.notResponded);

  const formatAddress = (location: Address) => {
    return `${location.street}, ${location.city}, ${location.state} ${location.postcode}`;
  };

  const getMapUrl = (coords: Coordinates) => {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${coords.longitude - 0.01},${coords.latitude - 0.01},${coords.longitude + 0.01},${coords.latitude + 0.01}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`;
  };

  const handleRSVPUpdate = async (status: RSVPStatus) => {
    try {
      await updateRSVPMutation.mutateAsync({ eventId: event.id, status });
      toast.success(`RSVP updated to "${getRSVPStatusLabel(status)}"`);
    } catch (error: any) {
      console.error('Failed to update RSVP:', error);
      toast.error(error.message || 'Failed to update RSVP');
    }
  };

  const handleChildRSVPUpdate = async (childId: string, status: RSVPStatus) => {
    try {
      await updateChildRSVPMutation.mutateAsync({ childId, eventId: event.id, status });
      toast.success(`Child RSVP updated to "${getRSVPStatusLabel(status)}"`);
    } catch (error: any) {
      console.error('Failed to update child RSVP:', error);
      toast.error(error.message || 'Failed to update child RSVP');
    }
  };

  const getRSVPStatusLabel = (status: RSVPStatus) => {
    switch (status) {
      case RSVPStatus.yes:
        return 'Going';
      case RSVPStatus.no:
        return 'Not Going';
      case RSVPStatus.maybe:
        return 'Maybe';
      default:
        return 'Not Responded';
    }
  };

  const team = allTeams.find(t => t.id === event.teamId);
  const teamName = team?.name || 'Unknown Team';

  const date = new Date(Number(event.dateTime / BigInt(1_000_000)));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <img src={getEventTypeIcon(event.eventType)} alt={event.eventType} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold truncate">{event.title}</h2>
            <p className="text-sm text-muted-foreground truncate">{teamName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCreator && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(event)}
                className="h-9 w-9"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="text-destructive hover:text-destructive h-9 w-9"
                onClick={() => onDelete(event)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="rsvp">
                Attendees ({isLoadingRSVPs ? '...' : rsvps.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getEventTypeLabel(event.eventType)}</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date & Time</p>
                    <p className="font-medium mt-1">{date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <div className="flex items-start gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium break-words">{formatAddress(event.location)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.coordinates.latitude.toFixed(6)}, {event.coordinates.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Map</p>
                    <div className="w-full h-64 rounded-lg overflow-hidden border">
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight={0}
                        marginWidth={0}
                        src={getMapUrl(event.coordinates)}
                        title="Event Location Map"
                      />
                    </div>
                  </div>
                  {event.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="mt-1 break-words">{event.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="rsvp" className="mt-4">
              {isLoadingRSVPs ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading attendees...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Current User RSVP Selection Card */}
                  {currentUserRSVP && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base sm:text-lg">Your RSVP</CardTitle>
                        <CardDescription>Let others know if you're attending</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            variant={currentUserRSVP.status === RSVPStatus.yes ? 'default' : 'outline'}
                            className="flex flex-col items-center gap-2 h-auto py-4"
                            onClick={() => handleRSVPUpdate(RSVPStatus.yes)}
                            disabled={updateRSVPMutation.isPending}
                          >
                            <span className="text-sm font-medium">Going</span>
                            {currentUserRSVP.status === RSVPStatus.yes && (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant={currentUserRSVP.status === RSVPStatus.maybe ? 'default' : 'outline'}
                            className="flex flex-col items-center gap-2 h-auto py-4"
                            onClick={() => handleRSVPUpdate(RSVPStatus.maybe)}
                            disabled={updateRSVPMutation.isPending}
                          >
                            <span className="text-sm font-medium">Maybe</span>
                            {currentUserRSVP.status === RSVPStatus.maybe && (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant={currentUserRSVP.status === RSVPStatus.no ? 'default' : 'outline'}
                            className="flex flex-col items-center gap-2 h-auto py-4"
                            onClick={() => handleRSVPUpdate(RSVPStatus.no)}
                            disabled={updateRSVPMutation.isPending}
                          >
                            <span className="text-sm font-medium">Not Going</span>
                            {currentUserRSVP.status === RSVPStatus.no && (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Child Profile RSVP Cards */}
                  {childRSVPs.map((childRSVP) => {
                    const childProfile = childProfiles.find(cp => cp.id === childRSVP.childProfileId);
                    if (!childProfile) return null;

                    return (
                      <Card key={childRSVP.childProfileId}>
                        <CardHeader>
                          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            <img src="/assets/generated/child-rsvp-icon-transparent.dim_16x16.png" alt="Child" className="h-5 w-5" />
                            {childProfile.name}'s RSVP
                          </CardTitle>
                          <CardDescription>Respond on behalf of your child</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              variant={childRSVP.status === RSVPStatus.yes ? 'default' : 'outline'}
                              className="flex flex-col items-center gap-2 h-auto py-4"
                              onClick={() => handleChildRSVPUpdate(childProfile.id, RSVPStatus.yes)}
                              disabled={updateChildRSVPMutation.isPending}
                            >
                              <span className="text-sm font-medium">Going</span>
                              {childRSVP.status === RSVPStatus.yes && (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant={childRSVP.status === RSVPStatus.maybe ? 'default' : 'outline'}
                              className="flex flex-col items-center gap-2 h-auto py-4"
                              onClick={() => handleChildRSVPUpdate(childProfile.id, RSVPStatus.maybe)}
                              disabled={updateChildRSVPMutation.isPending}
                            >
                              <span className="text-sm font-medium">Maybe</span>
                              {childRSVP.status === RSVPStatus.maybe && (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant={childRSVP.status === RSVPStatus.no ? 'default' : 'outline'}
                              className="flex flex-col items-center gap-2 h-auto py-4"
                              onClick={() => handleChildRSVPUpdate(childProfile.id, RSVPStatus.no)}
                              disabled={updateChildRSVPMutation.isPending}
                            >
                              <span className="text-sm font-medium">Not Going</span>
                              {childRSVP.status === RSVPStatus.no && (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Attendee Lists */}
                  {rsvps.length === 0 ? (
                    <Card>
                      <CardContent className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">No attendees yet</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <RSVPSection title="Going" responses={yesResponses} icon="/assets/generated/rsvp-yes-icon-transparent.dim_16x16.png" />
                      <RSVPSection title="Maybe" responses={maybeResponses} icon="/assets/generated/rsvp-maybe-icon-transparent.dim_16x16.png" />
                      <RSVPSection title="Not Going" responses={noResponses} icon="/assets/generated/rsvp-no-icon-transparent.dim_16x16.png" />
                      <RSVPSection title="Not Responded" responses={notRespondedResponses} icon="/assets/generated/event-calendar-icon-transparent.dim_24x24.png" />
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function RSVPSection({ title, responses, icon }: { title: string; responses: RSVPWithUser[]; icon: string }) {
  if (responses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <img src={icon} alt={title} className="h-5 w-5" />
          {title} ({responses.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {responses.map((response) => (
            <div key={`${response.userId}-${response.childProfileId || 'user'}`} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {response.isChildProfile && (
                  <img src="/assets/generated/child-rsvp-icon-transparent.dim_16x16.png" alt="Child" className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="font-medium truncate">{response.userName}</span>
              </div>
              <span className="text-sm text-muted-foreground flex-shrink-0">
                {new Date(Number(response.timestamp / BigInt(1_000_000))).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EventFormModal({
  title,
  description,
  isOpen,
  onClose,
  onSubmit,
  eventTitle,
  setEventTitle,
  eventType,
  setEventType,
  eventDate,
  setEventDate,
  eventTime,
  setEventTime,
  street,
  setStreet,
  city,
  setCity,
  state,
  setState,
  postcode,
  setPostcode,
  coordinates,
  isGeocoding,
  eventDescription,
  setEventDescription,
  selectedClubId,
  setSelectedClubId,
  selectedTeamId,
  setSelectedTeamId,
  clubs,
  teams,
  isLoadingClubs,
  submitLabel,
  isSubmitting,
  isRecurring,
  setIsRecurring,
  recurrencePattern,
  setRecurrencePattern,
  customInterval,
  setCustomInterval,
  occurrenceCount,
  setOccurrenceCount,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  eventTitle: string;
  setEventTitle: (value: string) => void;
  eventType: EventType;
  setEventType: (value: EventType) => void;
  eventDate: string;
  setEventDate: (value: string) => void;
  eventTime: string;
  setEventTime: (value: string) => void;
  street: string;
  setStreet: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: string;
  setState: (value: string) => void;
  postcode: string;
  setPostcode: (value: string) => void;
  coordinates: Coordinates | null;
  isGeocoding: boolean;
  eventDescription: string;
  setEventDescription: (value: string) => void;
  selectedClubId: string;
  setSelectedClubId: (value: string) => void;
  selectedTeamId: string;
  setSelectedTeamId: (value: string) => void;
  clubs: any[];
  teams: any[];
  isLoadingClubs: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  recurrencePattern: RecurrencePattern;
  setRecurrencePattern: (value: RecurrencePattern) => void;
  customInterval: string;
  setCustomInterval: (value: string) => void;
  occurrenceCount: string;
  setOccurrenceCount: (value: string) => void;
}) {
  const getMapUrl = (coords: Coordinates) => {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${coords.longitude - 0.01},${coords.latitude - 0.01},${coords.longitude + 0.01},${coords.latitude + 0.01}&layer=mapnik&marker=${coords.latitude},${coords.longitude}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="space-y-1 min-w-0 flex-1 pr-4">
          <h2 className="text-lg sm:text-xl font-bold truncate">{title}</h2>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-9 w-9">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto w-full">
          <div className="space-y-2">
            <Label htmlFor="eventTitle" className="text-base">Event Title</Label>
            <Input
              id="eventTitle"
              placeholder="Enter event title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventClub" className="text-base">Club</Label>
            {isLoadingClubs ? (
              <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading clubs...</span>
                </div>
              </div>
            ) : clubs.length === 0 ? (
              <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No clubs available. Create a club first.
                </p>
              </div>
            ) : (
              <Select value={selectedClubId || undefined} onValueChange={setSelectedClubId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventTeam" className="text-base">Team</Label>
            {isLoadingClubs ? (
              <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading teams...</span>
                </div>
              </div>
            ) : !selectedClubId ? (
              <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Select a club first
                </p>
              </div>
            ) : teams.length === 0 ? (
              <div className="h-12 flex items-center justify-center border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No teams available for this club. Create a team first.
                </p>
              </div>
            ) : (
              <Select 
                value={selectedTeamId || undefined} 
                onValueChange={setSelectedTeamId}
                disabled={!selectedClubId}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!selectedClubId && (
              <p className="text-xs text-muted-foreground">
                Please select a club before choosing a team
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventType" className="text-base">Event Type</Label>
            <Select value={eventType} onValueChange={(value) => setEventType(value as EventType)}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EventType.game}>Game</SelectItem>
                <SelectItem value={EventType.match}>Match</SelectItem>
                <SelectItem value={EventType.socialEvent}>Social Event</SelectItem>
                <SelectItem value={EventType.training}>Training</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventDate" className="text-base">Date</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventTime" className="text-base">Time</Label>
              <Input
                id="eventTime"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </div>

          {/* Recurring Event Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/assets/generated/recurring-event-icon-emerald-transparent.dim_24x24.png" alt="Recurring" className="h-5 w-5" />
                <Label htmlFor="isRecurring" className="text-base font-semibold cursor-pointer">
                  Recurring Event
                </Label>
              </div>
              <Switch
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>

            {isRecurring && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="recurrencePattern" className="text-sm">Recurrence Pattern</Label>
                  <Select value={recurrencePattern} onValueChange={(value) => setRecurrencePattern(value as RecurrencePattern)}>
                    <SelectTrigger className="h-12 text-base">
                      <Repeat className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly (Every 2 weeks)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom Interval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recurrencePattern === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="customInterval" className="text-sm">Repeat Every (days)</Label>
                    <Input
                      id="customInterval"
                      type="number"
                      min="1"
                      max="365"
                      value={customInterval}
                      onChange={(e) => setCustomInterval(e.target.value)}
                      className="h-12 text-base"
                      placeholder="7"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="occurrenceCount" className="text-sm">Number of Occurrences</Label>
                  <Input
                    id="occurrenceCount"
                    type="number"
                    min="2"
                    max="52"
                    value={occurrenceCount}
                    onChange={(e) => setOccurrenceCount(e.target.value)}
                    className="h-12 text-base"
                    placeholder="4"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many times should this event repeat?
                  </p>
                </div>

                <div className="p-3 bg-primary/10 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>Preview:</strong> This event will occur {occurrenceCount} times, repeating every{' '}
                    {recurrencePattern === 'weekly' ? '7 days (weekly)' :
                     recurrencePattern === 'fortnightly' ? '14 days (fortnightly)' :
                     recurrencePattern === 'monthly' ? '30 days (monthly)' :
                     `${customInterval} days`}.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/assets/generated/map-pin-icon-emerald-transparent.dim_24x24.png" alt="Location" className="h-5 w-5" />
              <Label className="text-base font-semibold">Location</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="street" className="text-base">Street Address</Label>
              <Input
                id="street"
                placeholder="123 Main Street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-base">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-base">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postcode" className="text-base">Postcode</Label>
              <Input
                id="postcode"
                placeholder="12345"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {isGeocoding && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src="/assets/generated/geocoding-icon-emerald-transparent.dim_20x20.png" alt="Geocoding" className="h-4 w-4 animate-pulse" />
                <span>Finding location...</span>
              </div>
            )}

            {coordinates && !isGeocoding && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src="/assets/generated/geocoding-icon-emerald-transparent.dim_20x20.png" alt="Coordinates" className="h-4 w-4" />
                  <Label className="text-sm text-muted-foreground">
                    Coordinates: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                  </Label>
                </div>
                <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden border">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={getMapUrl(coordinates)}
                    title="Location Preview"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventDescription" className="text-base">Description (Optional)</Label>
            <Textarea
              id="eventDescription"
              placeholder="Enter event description"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="min-h-[120px] text-base"
            />
          </div>
        </div>
      </div>

      <div className="border-t p-4 bg-background flex-shrink-0 sticky bottom-0 z-10">
        <div className="max-w-2xl mx-auto flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto h-12 sm:h-10" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} className="w-full sm:w-auto h-12 sm:h-10" disabled={isGeocoding || isLoadingClubs || isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

