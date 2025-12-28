import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkflowNode as WorkflowNodeType } from "@shared/schema";
import { 
  GitBranch, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Play, 
  Pause,
  ScanSearch,
  TrendingUp,
  MessageSquare,
  Filter,
  Clock,
  Bell,
  Database,
  GripVertical,
  X,
  Check,
  Settings
} from "lucide-react";

interface Connection {
  from: string;
  to: string;
}

const iconMap: Record<string, any> = {
  "ScanSearch": ScanSearch,
  "TrendingUp": TrendingUp,
  "Database": Database,
  "Filter": Filter,
  "Check": Check,
  "Clock": Clock,
  "MessageSquare": MessageSquare,
  "Bell": Bell,
};

const nodeTypes = [
  { type: "trigger", label: "Triggers", items: [
    { icon: "ScanSearch", label: "Dark Pool Scanner", color: "primary" },
    { icon: "TrendingUp", label: "Options Flow", color: "warning" },
    { icon: "Database", label: "Custom Data Source", color: "muted" },
  ]},
  { type: "filter", label: "Filters", items: [
    { icon: "Filter", label: "Volume Filter", color: "muted" },
    { icon: "Check", label: "Sentiment Check", color: "positive" },
    { icon: "Clock", label: "Time Filter", color: "secondary" },
  ]},
  { type: "action", label: "Actions", items: [
    { icon: "MessageSquare", label: "Generate Post", color: "positive" },
    { icon: "Clock", label: "Schedule", color: "secondary" },
    { icon: "Bell", label: "Send Alert", color: "negative" },
  ]},
];

const defaultConnections: Connection[] = [
  { from: "1", to: "3" },
  { from: "2", to: "4" },
  { from: "3", to: "5" },
  { from: "4", to: "5" },
  { from: "5", to: "6" },
  { from: "5", to: "7" },
];

export default function WorkflowCanvas() {
  const { data: nodes = [], isLoading } = useQuery<WorkflowNodeType[]>({
    queryKey: ['/api/workflow/nodes'],
  });

  const updateNodeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WorkflowNodeType> }) => {
      return apiRequest('PATCH', `/api/workflow/nodes/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow/nodes'] });
    },
  });

  const [connections] = useState<Connection[]>(defaultConnections);
  const [zoom, setZoom] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  const getNodePosition = (node: WorkflowNodeType) => {
    if (localPositions[node.id]) {
      return localPositions[node.id];
    }
    return { x: node.positionX || 0, y: node.positionY || 0 };
  };

  const handleNodeDrag = (nodeId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const pos = getNodePosition(node);
    const startNodeX = pos.x;
    const startNodeY = pos.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      
      setLocalPositions(prev => ({
        ...prev,
        [nodeId]: { x: startNodeX + deltaX, y: startNodeY + deltaY }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDraggedNode(null);
      
      const finalPos = localPositions[nodeId];
      if (finalPos) {
        updateNodeMutation.mutate({
          id: nodeId,
          updates: { positionX: finalPos.x, positionY: finalPos.y }
        });
      }
    };

    setDraggedNode(nodeId);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getNodeCenter = (node: WorkflowNodeType) => {
    const pos = getNodePosition(node);
    return { x: pos.x + 80, y: pos.y + 30 };
  };

  const renderConnection = (conn: Connection, idx: number) => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return null;

    const from = getNodeCenter(fromNode);
    const to = getNodeCenter(toNode);
    
    const midX = (from.x + to.x) / 2;
    const path = `M ${from.x + 80} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - 80} ${to.y}`;

    return (
      <g key={idx}>
        <path
          d={path}
          fill="none"
          stroke={fromNode.active && toNode.active ? "hsl(var(--primary))" : "hsl(var(--muted))"}
          strokeWidth={2}
          strokeDasharray={fromNode.active && toNode.active ? "none" : "5,5"}
          opacity={0.6}
          data-testid={`connection-${conn.from}-${conn.to}`}
        />
        {fromNode.active && toNode.active && isRunning && (
          <circle r="4" fill="hsl(var(--primary))">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        )}
      </g>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-hidden" data-testid="page-workflow-canvas">
      <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-workflow-canvas">Visual Workflow Canvas</h1>
          <p className="text-muted-foreground text-sm mt-1">Build and manage automation workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={isRunning ? "default" : "secondary"} 
            className={`gap-1.5 ${isRunning ? 'bg-positive/20 text-positive border-positive/30' : ''}`}
            data-testid="badge-workflow-status"
          >
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-positive pulse-dot' : 'bg-muted-foreground'}`} />
            {isRunning ? "Running" : "Paused"}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
            data-testid="button-toggle-workflow"
          >
            {isRunning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isRunning ? "Pause" : "Start"}
          </Button>
          <Button size="sm" data-testid="button-save-workflow">
            Save Workflow
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card className="w-64 flex-shrink-0 overflow-hidden" data-testid="card-node-library">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Node Library
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-4 overflow-auto max-h-[calc(100vh-300px)]">
            {nodeTypes.map((category) => (
              <div key={category.type}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground px-2 mb-2">
                  {category.label}
                </p>
                <div className="space-y-1">
                  {category.items.map((item, idx) => {
                    const Icon = iconMap[item.icon] || Database;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover-elevate cursor-grab"
                        draggable
                        data-testid={`node-library-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                        <div className={`w-6 h-6 rounded flex items-center justify-center bg-${item.color}/10`}>
                          <Icon className={`w-3 h-3 text-${item.color}`} />
                        </div>
                        <span className="text-xs">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden relative" data-testid="card-canvas">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-3/4 h-3/4" />
            </div>
          ) : (
            <div 
              ref={canvasRef}
              className="w-full h-full bg-background relative overflow-hidden"
              style={{ 
                backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`
              }}
              data-testid="workflow-canvas-area"
            >
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                {connections.map((conn, idx) => renderConnection(conn, idx))}
              </svg>

              <div 
                className="absolute inset-0"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                {nodes.map((node) => {
                  const Icon = iconMap[node.icon || "Database"] || Database;
                  const pos = getNodePosition(node);
                  return (
                    <div
                      key={node.id}
                      className={`absolute w-40 p-3 rounded-md border cursor-move transition-shadow
                        ${selectedNode === node.id ? 'ring-2 ring-primary' : ''}
                        ${node.active ? 'bg-card border-border' : 'bg-muted/50 border-muted opacity-60'}
                        ${draggedNode === node.id ? 'shadow-lg' : ''}`}
                      style={{ left: pos.x, top: pos.y }}
                      onMouseDown={(e) => handleNodeDrag(node.id, e)}
                      onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                      data-testid={`workflow-node-${node.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center bg-${node.color}/10`}>
                          <Icon className={`w-4 h-4 text-${node.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" data-testid={`text-node-label-${node.id}`}>{node.label}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{node.type}</p>
                        </div>
                      </div>
                      {node.active && isRunning && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-positive pulse-dot" data-testid={`indicator-active-${node.id}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-4 left-4 p-1 rounded-md bg-card/80 backdrop-blur border border-border" data-testid="minimap">
                <div className="w-32 h-20 bg-muted/50 rounded relative overflow-hidden">
                  {nodes.map((node) => {
                    const pos = getNodePosition(node);
                    return (
                      <div
                        key={node.id}
                        className="absolute w-3 h-2 rounded-sm bg-primary/60"
                        style={{ 
                          left: `${(pos.x / 1000) * 100}%`, 
                          top: `${(pos.y / 400) * 100}%` 
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="absolute bottom-4 right-4 flex gap-1" data-testid="zoom-controls">
                <Button variant="outline" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetZoom} className="w-16 font-mono" data-testid="button-zoom-reset">
                  {Math.round(zoom * 100)}%
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" data-testid="button-fullscreen">
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {selectedNode && (
          <Card className="w-72 flex-shrink-0" data-testid="card-node-settings">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Node Settings</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedNode(null)}
                data-testid="button-close-settings"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const node = nodes.find(n => n.id === selectedNode);
                if (!node) return null;
                const Icon = iconMap[node.icon || "Database"] || Database;
                return (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50" data-testid="selected-node-info">
                      <div className={`w-10 h-10 rounded flex items-center justify-center bg-${node.color}/10`}>
                        <Icon className={`w-5 h-5 text-${node.color}`} />
                      </div>
                      <div>
                        <p className="font-medium" data-testid="text-selected-node-label">{node.label}</p>
                        <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between" data-testid="node-status">
                      <span className="text-sm">Enabled</span>
                      <Badge 
                        variant={node.active ? "default" : "secondary"}
                        className={node.active ? "bg-positive/20 text-positive" : ""}
                        data-testid="badge-node-active"
                      >
                        {node.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Configuration</p>
                      <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                        Node-specific settings would appear here based on the node type.
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      size="sm"
                      data-testid="button-configure-node"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                    <Button 
                      variant={node.active ? "secondary" : "default"} 
                      className="w-full" 
                      size="sm"
                      onClick={() => {
                        updateNodeMutation.mutate({
                          id: node.id,
                          updates: { active: !node.active }
                        });
                      }}
                      data-testid="button-toggle-node"
                    >
                      {node.active ? "Disable Node" : "Enable Node"}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
