import { Container, Title, Text, Paper, Stack, ThemeIcon, Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

export const ExamCompletePage = () => {
  return (
    <Container size="sm" py={100}>
      <Paper radius="md" p="xl" withBorder ta="center">
        <Stack gap="lg" align="center">
          <ThemeIcon size={80} radius="xl" color="green">
            <IconCheck size={48} />
          </ThemeIcon>

          <Title order={2}>Prüfung abgegeben!</Title>

          <Text c="dimmed" maw={400}>
            Ihre Antworten wurden erfolgreich gespeichert. Sie können dieses Fenster jetzt
            schließen.
          </Text>

          <Text size="sm" c="dimmed">
            Ihre Lehrkraft wird die Prüfung auswerten und Ihnen das Ergebnis mitteilen.
          </Text>

          <Button variant="light" onClick={() => window.close()}>
            Fenster schließen
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};
