import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  User, 
  Palette,
  Clock,
  Save
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-4xl">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notification Settings
            </CardTitle>
            <CardDescription>Control how you receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dark Pool Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified on significant dark pool activity</p>
              </div>
              <Switch defaultChecked data-testid="switch-dark-pool-alerts" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Options Sweep Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified on unusual options sweeps</p>
              </div>
              <Switch defaultChecked data-testid="switch-options-alerts" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Post Performance Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when posts hit engagement milestones</p>
              </div>
              <Switch data-testid="switch-performance-alerts" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive daily summary emails</p>
              </div>
              <Switch data-testid="switch-email-notifications" />
            </div>
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
