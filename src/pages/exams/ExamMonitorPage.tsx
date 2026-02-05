import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Badge,
  Button,
  Skeleton,
  Alert,
  Progress,
  Table,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconClock,
} from '@tabler/icons-react';
import { useGetExamWithQuestionsQuery } from '../../services/exams/examsApi';
import { useGetExamSessionsQuery, useGetAnswersForSessionQuery } from '../../services/sessions/sessionsApi';
import { supabase } from '../../services/common/supabase';
import { ExamSession } from '../../types/database';

export const ExamMonitorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: exam, isLoading: loadingExam } = useGetExamWithQuestionsQuery(id || '', {
    skip: !id,
  });

  const { data: sessions, isLoading: loadingSessions, refetch: refetchSessions } = useGetExamSessionsQuery(id || '', {
    skip: !id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`exam_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exam_sessions',
          filter: `exam_id=eq.${id}`,
        },
        () => {
          refetchSessions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
        },
        () => {
          refetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refetchSessions]);

  if (loadingExam || loadingSessions) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Prüfung konnte nicht geladen werden.
        </Alert>
      </Container>
    );
  }

  const totalQuestions = exam.questions.length;
  const submittedCount = sessions?.filter(s => s.submitted_at).length || 0;
  const activeCount = sessions?.filter(s => !s.submitted_at).length || 0;

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(`/exams/${id}`)}
            >
              Zurück
            </Button>
            <Title order={2}>{exam.title} - Live-Überwachung</Title>
          </Group>
          <Tooltip label="Aktualisieren">
            <ActionIcon variant="light" onClick={() => refetchSessions()}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group grow>
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" c="dimmed">
              Teilnehmer gesamt
            </Text>
            <Text size="xl" fw={700}>
              {sessions?.length || 0}
            </Text>
          </Paper>
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" c="dimmed">
              In Bearbeitung
            </Text>
            <Text size="xl" fw={700} c="orange">
              {activeCount}
            </Text>
          </Paper>
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" c="dimmed">
              Abgegeben
            </Text>
            <Text size="xl" fw={700} c="green">
              {submittedCount}
            </Text>
          </Paper>
        </Group>

        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            Teilnehmer
          </Title>
          {!sessions || sessions.length === 0 ? (
            <Text c="dimmed" size="sm">
              Noch keine Teilnehmer.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>E-Mail</Table.Th>
                  <Table.Th>Gestartet</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Fortschritt</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    totalQuestions={totalQuestions}
                  />
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Container>
  );
};

const SessionRow = ({
  session,
  totalQuestions,
}: {
  session: ExamSession;
  totalQuestions: number;
}) => {
  const { data: answers } = useGetAnswersForSessionQuery(session.id);

  const answeredCount = answers?.length || 0;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <Table.Tr>
      <Table.Td>{session.student_name}</Table.Td>
      <Table.Td>{session.student_email}</Table.Td>
      <Table.Td>
        {new Date(session.started_at).toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Table.Td>
      <Table.Td>
        {session.submitted_at ? (
          <Badge color="green" leftSection={<IconCheck size={12} />}>
            Abgegeben
          </Badge>
        ) : (
          <Badge color="orange" leftSection={<IconClock size={12} />}>
            In Bearbeitung
          </Badge>
        )}
      </Table.Td>
      <Table.Td style={{ width: 200 }}>
        <Group gap="xs">
          <Progress
            value={progress}
            size="sm"
            style={{ flex: 1 }}
            color={session.submitted_at ? 'green' : 'blue'}
          />
          <Text size="xs" c="dimmed">
            {answeredCount}/{totalQuestions}
          </Text>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
};
