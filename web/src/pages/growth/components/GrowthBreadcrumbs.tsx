import { Breadcrumbs, Link, Typography, Stack, Container } from '@mui/material';
import NavigateNext from '@mui/icons-material/NavigateNext';
import { Link as RouterLink } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface GrowthBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function GrowthBreadcrumbs({ items }: GrowthBreadcrumbsProps) {
  return (
    <Container maxWidth="lg" sx={{ pt: 2, pb: 1 }}>
      <Stack direction="row" alignItems="center">
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" sx={{ color: 'text.disabled' }} />}
          aria-label="Navegação estrutural"
        >
          <Link
            component={RouterLink}
            to="/"
            color="text.secondary"
            underline="hover"
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Início
          </Link>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            if (isLast || !item.path) {
              return (
                <Typography
                  key={idx}
                  color="text.primary"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {item.label}
                </Typography>
              );
            }
            return (
              <Link
                key={idx}
                component={RouterLink}
                to={item.path}
                color="text.secondary"
                underline="hover"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      </Stack>
    </Container>
  );
}
