import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Stack,
  Box,
  useTheme,
  alpha,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';

export interface FaqItem {
  question: string;
  answer: string;
}

interface GrowthFaqProps {
  items: FaqItem[];
  title?: string;
}

export function GrowthFaq({ items, title = 'Perguntas Frequentes' }: GrowthFaqProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h3" fontWeight={800} textAlign="center">
          {title}
        </Typography>

        <Stack spacing={1.5} sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
          {items.map((item, index) => {
            const panelId = `panel-${index}`;
            return (
              <Accordion
                key={index}
                expanded={expanded === panelId}
                onChange={handleChange(panelId)}
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '12px !important',
                  '&:before': { display: 'none' },
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.4),
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  aria-controls={`${panelId}-content`}
                  id={`${panelId}-header`}
                  sx={{
                    minHeight: 52,
                    px: 3,
                    '& .MuiAccordionSummary-content': { my: 1.5 },
                  }}
                >
                  <Typography fontWeight={700} sx={{ fontSize: '1rem' }}>
                    {item.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pt: 0, pb: 2.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {item.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}
