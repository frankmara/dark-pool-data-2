import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  PenTool, 
  Copy, 
  Send, 
  Clock, 
  Beaker, 
  Plus,
  X,
  Image as ImageIcon,
  Hash,
  AtSign,
  BarChart3,
  Sparkles
} from "lucide-react";

interface PostVariant {
  id: string;
  content: string;
  tags: string[];
}

export default function PostConstructor() {
  const { toast } = useToast();
  const [variants, setVariants] = useState<PostVariant[]>([
    { id: "A", content: "", tags: [] },
    { id: "B", content: "", tags: [] },
  ]);
  const [activeVariant, setActiveVariant] = useState("A");
  const [isABTest, setIsABTest] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const currentVariant = variants.find(v => v.id === activeVariant) || variants[0];
  const charCount = currentVariant.content.length;
  const maxChars = 280;

  const createPostMutation = useMutation({
    mutationFn: async (postData: { content: string; variant: string; status: string; tags: string[] }) => {
      return apiRequest('POST', '/api/posts', postData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts'] });
      toast({
        title: "Post created",
        description: "Your post has been saved successfully.",
      });
      setVariants([
        { id: "A", content: "", tags: [] },
        { id: "B", content: "", tags: [] },
      ]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleContentChange = (content: string) => {
    setVariants(prev => prev.map(v => 
      v.id === activeVariant ? { ...v, content } : v
    ));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !currentVariant.tags.includes(tagInput.trim())) {
      setVariants(prev => prev.map(v => 
        v.id === activeVariant ? { ...v, tags: [...v.tags, tagInput.trim()] } : v
      ));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setVariants(prev => prev.map(v => 
      v.id === activeVariant ? { ...v, tags: v.tags.filter(t => t !== tag) } : v
    ));
  };

  const handleSaveDraft = () => {
    createPostMutation.mutate({
      content: currentVariant.content,
      variant: currentVariant.id,
      status: "draft",
      tags: currentVariant.tags,
    });
  };

  const handleSchedule = () => {
    createPostMutation.mutate({
      content: currentVariant.content,
      variant: currentVariant.id,
      status: "scheduled",
      tags: currentVariant.tags,
    });
  };

  const handlePostNow = () => {
    createPostMutation.mutate({
      content: currentVariant.content,
      variant: currentVariant.id,
      status: "posted",
      tags: currentVariant.tags,
    });
  };

  const templatePosts = [
    { label: "Dark Pool Alert", template: "Dark Pool Alert\n\n$[TICKER] seeing unusual institutional activity\n\nVolume: [VOLUME]\nFlow: [DIRECTION]\nSentiment: [SENTIMENT]\n\nKey levels to watch:" },
    { label: "Options Sweep", template: "Unusual Options Activity\n\n$[TICKER] [STRIKE] [TYPE] [EXPIRY]\n\nPremium: $[PREMIUM]\nVolume: [VOL] vs OI: [OI]\n\nThis could indicate:" },
    { label: "Thread Opener", template: "Thread: Institutional Flow Analysis\n\n[DATE] Market Summary\n\nLet's break down what smart money is doing:" },
  ];

  const suggestedTags = ["darkpool", "options", "institutional", "flow", "trading", "analysis", "market", "stocks"];

  return (
    <div className="p-6 space-y-6 overflow-auto h-full" data-testid="page-post-constructor">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-post-constructor">Post Constructor & A/B Lab</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, test, and optimize your posts</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2" data-testid="toggle-ab-testing">
            <Beaker className="w-4 h-4 text-primary" />
            <span className="text-sm">A/B Testing</span>
            <Switch 
              checked={isABTest}
              onCheckedChange={setIsABTest}
              data-testid="switch-ab-test"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card data-testid="card-compose-post">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-primary" />
                  Compose Post
                </CardTitle>
                {isABTest && (
                  <div className="flex gap-1">
                    {variants.map((v) => (
                      <Button
                        key={v.id}
                        variant={activeVariant === v.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveVariant(v.id)}
                        data-testid={`button-variant-${v.id}`}
                      >
                        Variant {v.id}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Content</Label>
                  <span 
                    className={`text-xs font-mono ${charCount > maxChars ? 'text-negative' : charCount > maxChars * 0.9 ? 'text-warning' : 'text-muted-foreground'}`}
                    data-testid="text-char-count"
                  >
                    {charCount}/{maxChars}
                  </span>
                </div>
                <Textarea
                  placeholder="What's happening in the markets?"
                  value={currentVariant.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="min-h-[200px] font-mono text-sm resize-none"
                  data-testid="textarea-post-content"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" data-testid="button-add-image">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Image
                </Button>
                <Button variant="outline" size="sm" data-testid="button-add-mention">
                  <AtSign className="w-4 h-4 mr-2" />
                  Mention
                </Button>
                <Button variant="outline" size="sm" data-testid="button-add-hashtag">
                  <Hash className="w-4 h-4 mr-2" />
                  Hashtag
                </Button>
                <Button variant="outline" size="sm" data-testid="button-ai-enhance">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Enhance
                </Button>
              </div>

              <div>
                <Label className="mb-2 block">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1"
                    data-testid="input-tag"
                  />
                  <Button variant="outline" size="icon" onClick={handleAddTag} data-testid="button-add-tag">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="container-tags">
                  {currentVariant.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1" data-testid={`badge-tag-${tag}`}>
                      #{tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-negative"
                        data-testid={`button-remove-tag-${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Suggested:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedTags.filter(t => !currentVariant.tags.includes(t)).slice(0, 5).map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="outline" 
                        className="cursor-pointer hover-elevate text-xs"
                        onClick={() => setVariants(prev => prev.map(v => 
                          v.id === activeVariant ? { ...v, tags: [...v.tags, tag] } : v
                        ))}
                        data-testid={`badge-suggested-${tag}`}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-quick-templates">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {templatePosts.map((template, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => handleContentChange(template.template)}
                    data-testid={`button-template-${idx}`}
                  >
                    <div className="text-left">
                      <p className="font-medium">{template.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{template.template.substring(0, 50)}...</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card data-testid="card-preview">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg p-4 bg-background">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">DP</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Dark Pool Data</span>
                      <span className="text-muted-foreground text-sm">@darkpooldata</span>
                      <span className="text-muted-foreground text-xs">· Just now</span>
                    </div>
                    <div className="mt-2 text-sm whitespace-pre-wrap" data-testid="preview-content">
                      {currentVariant.content || <span className="text-muted-foreground italic">Your post preview will appear here...</span>}
                    </div>
                    {currentVariant.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1" data-testid="preview-tags">
                        {currentVariant.tags.map((tag) => (
                          <span key={tag} className="text-primary text-sm">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-6 mt-4 text-muted-foreground">
                      <span className="text-xs">0 replies</span>
                      <span className="text-xs">0 retweets</span>
                      <span className="text-xs">0 likes</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isABTest && (
            <Card data-testid="card-ab-comparison">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-primary" />
                  A/B Test Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {variants.map((v) => (
                    <div 
                      key={v.id}
                      className={`p-3 rounded-md border ${activeVariant === v.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                      data-testid={`card-variant-${v.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={activeVariant === v.id ? "default" : "outline"}>
                          Variant {v.id}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {v.content.length}/{maxChars}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {v.content || "Empty"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    A/B testing will split your audience 50/50 and measure engagement after 24 hours. 
                    The winning variant will be promoted automatically.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-predicted-performance">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-positive" />
                Predicted Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Engagement Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-positive w-3/4 rounded-full" />
                    </div>
                    <span className="text-sm font-mono" data-testid="metric-engagement-score">75%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Reach Potential</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-4/5 rounded-full" />
                    </div>
                    <span className="text-sm font-mono" data-testid="metric-reach-potential">82%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Viral Probability</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-warning w-1/3 rounded-full" />
                    </div>
                    <span className="text-sm font-mono" data-testid="metric-viral-probability">35%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleSaveDraft}
              disabled={!currentVariant.content || createPostMutation.isPending}
              data-testid="button-save-draft"
            >
              <Copy className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleSchedule}
              disabled={!currentVariant.content || createPostMutation.isPending}
              data-testid="button-schedule"
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule
            </Button>
            <Button 
              className="flex-1" 
              onClick={handlePostNow}
              disabled={!currentVariant.content || createPostMutation.isPending}
              data-testid="button-post-now"
            >
              <Send className="w-4 h-4 mr-2" />
              Post Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
