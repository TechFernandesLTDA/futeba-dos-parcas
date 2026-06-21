import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import { NavigateNext } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb hierárquico para telas de detalhe.
 * Renderiza apenas em md+. Em mobile, ArrowBack do header já é suficiente.
 */
export function AppBreadcrumbs({ items }: AppBreadcrumbsProps) {
  const { t } = useTranslation();
  if (items.length <= 1) return null;

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'block' },
        px: { md: 2, lg: 2.5 },
        py: 0.5,
        flexShrink: 0,
      }}
    >
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" />}
        aria-label={t('a11y.breadcrumb')}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          if (isLast || !item.to) {
            return (
              <Typography
                key={`${item.label}-${idx}`}
                color={isLast ? 'text.primary' : 'text.secondary'}
                sx={{ fontSize: '0.8125rem' }}
              >
                {item.label}
              </Typography>
            );
          }
          return (
            <Fragment key={`${item.label}-${idx}`}>
              <Link
                component={RouterLink}
                to={item.to}
                underline="hover"
                color="inherit"
                sx={{ fontSize: '0.8125rem' }}
              >
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
