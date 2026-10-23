import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, EmptyState, Page } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <Page>
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <Link to="/">
            <Button>Back to overview</Button>
          </Link>
        }
      >
        The page you are looking for does not exist or has moved.
      </EmptyState>
    </Page>
  );
}
