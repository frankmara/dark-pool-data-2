import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NotificationChannel, AlertRule } from "@shared/schema";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  User, 
  Clock,
  Save,
  Mail,
  MessageSquare,
  Webhook,
  Plus,
  Trash2,
  AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Settings() {
  const { toast } = useToast();
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelType, setNewChannelType] = useState<string>("email");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelEndpoint, setNewChannelEndpoint] = useState("");

  const { data: channels = [], isLoading: channelsLoading } = useQuery<NotificationChannel[]>({
    queryKey: ['/api/notifications/channels'],
  });

  const { data: alertRules = [], isLoading: alertsLoading } = useQuery<AlertRule[]>({
    queryKey: ['/api/notifications/alerts'],
  });

  const createChannelMutation = useMutation({
    mutationFn: async (channel: { type: string; name: string; endpoint: string; enabled: boolean }) => {
      return apiRequest('POST', '/api/notifications/channels', channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/channels'] });
      setNewChannelOpen(false);
      setNewChannelName("");
      setNewChannelEndpoint("");
      toast({ title: "Channel added", description: "Notification channel created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create channel", variant: "destructive" });
    }
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/notifications/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/channels'] });
      toast({ title: "Channel removed", description: "Notification channel deleted" });
    }
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/notifications/alerts/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/alerts'] });
    }
  });

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'sms': return MessageSquare;
      case 'discord': return Webhook;
      default: return Bell;
    }
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim() || !newChannelEndpoint.trim()) return;
    createChannelMutation.mutate({
      type: newChannelType,
      name: newChannelName,
      endpoint: newChannelEndpoint,
      enabled: true
    });
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-4xl" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace preferences</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile Settings
            </CardTitle>
            <CardDescription>Manage your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Display Name</Label>
                <Input defaultValue="Dark Pool Data" className="mt-1" data-testid="input-display-name" />
              </div>
              <div>
                <Label>Twitter Handle</Label>
                <Input defaultValue="@darkpooldata" className="mt-1" data-testid="input-twitter-handle" />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <Input defaultValue="Institutional-grade dark pool & options flow analysis" className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-notification-channels">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Channels
              </CardTitle>
              <CardDescription>Configure where you receive alerts</CardDescription>
            </div>
            <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-channel">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Channel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Notification Channel</DialogTitle>
                  <DialogDescription>Configure a new notification endpoint</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Channel Type</Label>
                    <Select value={newChannelType} onValueChange={setNewChannelType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="discord">Discord Webhook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input 
                      value={newChannelName} 
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g., Primary Email"
                      className="mt-1"
                      data-testid="input-channel-name"
                    />
                  </div>
                  <div>
                    <Label>
                      {newChannelType === 'email' ? 'Email Address' : 
                       newChannelType === 'sms' ? 'Phone Number' : 'Webhook URL'}
                    </Label>
                    <Input 
                      value={newChannelEndpoint} 
                      onChange={(e) => setNewChannelEndpoint(e.target.value)}
                      placeholder={
                        newChannelType === 'email' ? 'email@example.com' :
                        newChannelType === 'sms' ? '+1234567890' :
                        'https://discord.com/api/webhooks/...'
                      }
                      className="mt-1"
                      data-testid="input-channel-endpoint"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewChannelOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleCreateChannel} 
                    disabled={createChannelMutation.isPending}
                    data-testid="button-save-channel"
                  >
                    {createChannelMutation.isPending ? "Saving..." : "Add Channel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelsLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notification channels configured</p>
                <p className="text-xs">Add a channel to receive alerts</p>
              </div>
            ) : (
              channels.map((channel) => {
                const Icon = getChannelIcon(channel.type);
                return (
                  <div 
                    key={channel.id} 
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`channel-${channel.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{channel.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{channel.endpoint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{channel.type}</Badge>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteChannelMutation.mutate(channel.id)}
                        data-testid={`button-delete-channel-${channel.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-alert-rules">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alert Rules
            </CardTitle>
            <CardDescription>Configure which events trigger notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alertsLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              alertRules.map((rule) => (
                <div key={rule.id} data-testid={`alert-rule-${rule.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.alertType === 'missed_post' && 'Alert when a high-conviction signal is not posted'}
                        {rule.alertType === 'follower_drop' && `Alert when followers drop by >${rule.threshold}%`}
                        {rule.alertType === 'engagement_velocity' && `Alert when engagement rate falls below ${rule.threshold}%`}
                        {rule.alertType === 'api_key_expiry' && `Alert ${rule.threshold} days before API keys expire`}
                      </p>
                    </div>
                    <Switch 
                      checked={rule.enabled || false}
                      onCheckedChange={(checked) => updateAlertMutation.mutate({ id: rule.id, enabled: checked })}
                      data-testid={`switch-alert-${rule.id}`}
                    />
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Automation Settings
            </CardTitle>
            <CardDescription>Configure automation behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum Volume Threshold</Label>
                <Input type="number" defaultValue="1000000" className="mt-1 font-mono" />
              </div>
              <div>
                <Label>Post Delay (minutes)</Label>
                <Input type="number" defaultValue="5" className="mt-1 font-mono" />
              </div>
            </div>
            <div>
              <Label>Default Timezone</Label>
              <Select defaultValue="est">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="est">Eastern (EST/EDT)</SelectItem>
                  <SelectItem value="pst">Pacific (PST/PDT)</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Thread Long Posts</p>
                <p className="text-xs text-muted-foreground">Automatically split long content into threads</p>
              </div>
              <Switch defaultChecked data-testid="switch-auto-thread" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
            <CardDescription>Manage security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm">Enable</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">API Access Logs</p>
                <p className="text-xs text-muted-foreground">View all API access activity</p>
              </div>
              <Button variant="outline" size="sm">View Logs</Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button data-testid="button-save-settings">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
