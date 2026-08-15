import type { ReactNode } from 'react';
import { EventWorkspaceLayout } from './EventWorkspaceLayout';
import { useEventWorkspaceEvent } from './useEventWorkspaceEvent';
import { Alert } from '../ui/Alert';
import { LoadingBlock } from '../ui/LoadingBlock';

type Props = {
  pageTitle: string;
  pageSubtitle: string;
  pageTitleIcon?: ReactNode;
  headerActions?: ReactNode;
  loadingLabel: string;
  notFoundLabel: string;
  children: ReactNode;
};

export function EventWorkspacePage({
  pageTitle,
  pageSubtitle,
  pageTitleIcon,
  headerActions,
  loadingLabel,
  notFoundLabel,
  children,
}: Props) {
  const { event, loading, notFound } = useEventWorkspaceEvent();

  const layoutProps = {
    event,
    pageTitle,
    pageSubtitle,
    pageTitleIcon,
    headerActions,
  };

  if (loading) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <LoadingBlock label={loadingLabel} />
      </EventWorkspaceLayout>
    );
  }

  if (notFound || !event) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <Alert tone="error">{notFoundLabel}</Alert>
      </EventWorkspaceLayout>
    );
  }

  return <EventWorkspaceLayout {...layoutProps}>{children}</EventWorkspaceLayout>;
}
