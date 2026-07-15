import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeoMetadata } from './metadata';

export function SeoMetadata({ pathname }: { pathname: string }) {
  useEffect(() => {
    applySeoMetadata(pathname);
  }, [pathname]);

  return null;
}

/** Mount once inside BrowserRouter to keep metadata synchronized with navigation. */
export function RouteSeoMetadata() {
  const { pathname } = useLocation();
  return <SeoMetadata pathname={pathname} />;
}
