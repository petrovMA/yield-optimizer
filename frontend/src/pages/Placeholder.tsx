import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

const Placeholder = () => {
  const location = useLocation();

  const requestPageBuild = () => {
    // Post message to parent window (iframe parent)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'BUILD_PAGE_REQUEST',
        path: location.pathname,
        url: window.location.href,
        timestamp: Date.now()
      }, '*');
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-24">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🚀 Page Not Found</CardTitle>
          <CardDescription>
            This route doesn't exist yet. Click below to ask AI to build it!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm text-muted-foreground">{location.pathname}</code>
          </div>
          <div className="flex gap-2">
            <Button onClick={requestPageBuild} className="flex-1">
              Build This Page with AI
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Placeholder;