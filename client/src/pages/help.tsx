import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  HelpCircle, 
  Book, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  Search,
  Zap,
  BarChart3,
  Database,
  GitBranch
} from "lucide-react";

const helpTopics = [
  {
    icon: Zap,
    title: "Getting Started",
    description: "Learn the basics of setting up your workspace",
    articles: 5
  },
  {
    icon: BarChart3,
    title: "Analytics & Reporting",
    description: "Understanding your post performance metrics",
    articles: 8
  },
  {
    icon: Database,
    title: "Data Feeds",
    description: "Connecting and managing your data sources",
    articles: 12
  },
  {
    icon: GitBranch,
    title: "Workflow Automation",
    description: "Building custom automation workflows",
    articles: 15
  },
];

const faqItems = [
  {
    question: "How do I connect my Twitter account?",
    answer: "Navigate to Data Feeds, find Twitter/X API, and click 'Connect'. You'll be redirected to authorize the app."
  },
  {
    question: "What is dark pool data?",
    answer: "Dark pools are private exchanges where large institutional trades occur away from public markets. Our scanner tracks this activity."
  },
  {
    question: "How does A/B testing work?",
    answer: "Create two variants of your post, and we'll split your audience 50/50 to measure which performs better over 24 hours."
  },
  {
    question: "Can I customize automation triggers?",
    answer: "Yes! Use the Visual Workflow Canvas to create custom triggers, filters, and actions for your automation."
  },
];

export default function Help() {
  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Help Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Find answers and get support</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search for help..." 
          className="pl-10"
          data-testid="input-help-search"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {helpTopics.map((topic, idx) => (
          <Card key={idx} className="hover-elevate cursor-pointer" data-testid={`help-topic-${idx}`}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <topic.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{topic.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                <p className="text-xs text-muted-foreground mt-2">{topic.articles} articles</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqItems.map((item, idx) => (
            <div key={idx} className="pb-4 border-b border-border last:border-0 last:pb-0">
              <h4 className="font-medium text-sm">{item.question}</h4>
              <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Book className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h3 className="font-medium">Documentation</h3>
            <p className="text-xs text-muted-foreground mt-1">Browse our full documentation</p>
            <Button variant="outline" size="sm" className="mt-3">
              View Docs
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-positive" />
            <h3 className="font-medium">Community</h3>
            <p className="text-xs text-muted-foreground mt-1">Join our Discord community</p>
            <Button variant="outline" size="sm" className="mt-3">
              Join Discord
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="w-8 h-8 mx-auto mb-2 text-warning" />
            <h3 className="font-medium">Support</h3>
            <p className="text-xs text-muted-foreground mt-1">Get help from our team</p>
            <Button variant="outline" size="sm" className="mt-3">
              Contact Us
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
