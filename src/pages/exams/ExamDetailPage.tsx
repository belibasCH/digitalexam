import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconEdit,
  IconPlayerPlay,
  IconPlayerStop,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconArrowLeft,
  IconEye,
} from '@tabler/icons-react';
import {
  useGetExamWithQuestionsQuery,
  useActivateExamMutation,
  useCloseExamMutation,
} from '../../services/exams/examsApi';
import { notifications } from '@mantine/notifications';
import { SendInvitationsModal } from '../../components/exams/SendInvitationsModal';

export const ExamDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: exam, isLoading, error } = useGetExamWithQuestionsQuery(id || '', {
    skip: !id,
  });

  const [activateExam] = useActivateExamMutation();
  const [closeExam, { isLoading: closing }] = useCloseExamMutation();
  const [showInvitationModal, setShowInvitationModal] = useState(false);

  const examLink = `${window.location.origin}/take/${id}`;

  const handleActivate = () => {
    setShowInvitationModal(true);
  };

  const doActivate = async () => {
    if (!id) return;
    try {
      await activateExam(id).unwrap();
      notifications.show({
        title: 'Prüfung aktiviert',
        message: 'Die Prüfung ist jetzt für Schüler zugänglich.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht aktiviert werden.',
        color: 'red',
      });
      throw new Error('Activation failed');
    }
  };

  const handleClose = async () => {
    if (!id) return;
    if (!window.confirm('Möchten Sie die Prüfung wirklich beenden?')) return;

    try {
      await closeExam(id).unwrap();
      notifications.show({
        title: 'Prüfung beendet',
        message: 'Die Prüfung wurde geschlossen.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht beendet werden.',
        color: 'red',
      });
    }
  };

  if (isLoading) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  if (error || !exam) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Prüfung konnte nicht geladen werden.
        </Alert>
      </Container>
    );
  }

  const sections = exam.sections || [];
  const hasSections = sections.length > 0;
  const allQuestions = hasSections
    ? sections.flatMap(s => s.questions)
    : exam.questions;
  const totalPoints = allQuestions.reduce((sum, q) => sum + q.points, 0);
  const totalSections = sections.length;

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/exams')}
            >
              Zurück
            </Button>
          </Group>
          <Group>
            {exam.status === 'draft' && (
              <>
                <Button
                  component={Link}
                  to={`/exams/${id}/edit`}
                  variant="light"
                  leftSection={<IconEdit size={16} />}
                >
                  Bearbeiten
                </Button>
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={handleActivate}
                >
                  Aktivieren
                </Button>
              </>
            )}
            {exam.status === 'active' && (
              <>
                <Button
                  component={Link}
                  to={`/exams/${id}/monitor`}
                  variant="light"
                  leftSection={<IconEye size={16} />}
                >
                  Überwachen
                </Button>
                <Button
                  color="orange"
                  leftSection={<IconPlayerStop size={16} />}
                  onClick={handleClose}
                  loading={closing}
                >
                  Beenden
                </Button>
              </>
            )}
            {exam.status === 'closed' && (
              <Button
                component={Link}
                to={`/exams/${id}/evaluate`}
                leftSection={<IconEye size={16} />}
              >
                Auswerten
              </Button>
            )}
          </Group>
        </Group>

        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="sm">
                <Title order={2}>{exam.title}</Title>
                <Badge
                  color={
                    exam.status === 'active'
                      ? 'green'
                      : exam.status === 'closed'
                        ? 'red'
                        : 'gray'
                  }
                >
                  {exam.status === 'active'
                    ? 'Aktiv'
                    : exam.status === 'closed'
                      ? 'Beendet'
                      : 'Entwurf'}
                </Badge>
              </Group>
              {exam.description && (
                <Text c="dimmed" mt="xs">
                  {exam.description}
                </Text>
              )}
            </div>
          </Group>

          <Group gap="xl">
            {hasSections && (
              <div>
                <Text size="sm" c="dimmed">
                  Sektionen
                </Text>
                <Text fw={500}>{totalSections}</Text>
              </div>
            )}
            <div>
              <Text size="sm" c="dimmed">
                Aufgaben
              </Text>
              <Text fw={500}>{allQuestions.length}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Gesamtpunkte
              </Text>
              <Text fw={500}>{totalPoints}</Text>
            </div>
            {exam.time_limit_minutes && (
              <div>
                <Text size="sm" c="dimmed">
                  Zeitlimit
                </Text>
                <Text fw={500}>{exam.time_limit_minutes} Minuten</Text>
              </div>
            )}
            <div>
              <Text size="sm" c="dimmed">
                Erstellt am
              </Text>
              <Text fw={500}>
                {new Date(exam.created_at).toLocaleDateString('de-DE')}
              </Text>
            </div>
          </Group>
        </Paper>

        {exam.status === 'active' && (
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">
              Prüfungslink
            </Title>
            <Group>
              <Text
                size="sm"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--mantine-color-gray-0)',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                }}
              >
                {examLink}
              </Text>
              <CopyButton value={examLink}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Kopiert!' : 'Link kopieren'}>
                    <ActionIcon color={copied ? 'teal' : 'blue'} onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Teilen Sie diesen Link mit Ihren Schülern, damit sie an der Prüfung teilnehmen können.
            </Text>
          </Paper>
        )}

        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            {hasSections ? `Sektionen (${totalSections})` : `Aufgaben (${allQuestions.length})`}
          </Title>
          {allQuestions.length === 0 ? (
            <Text c="dimmed" size="sm">
              Keine Aufgaben zugewiesen.
            </Text>
          ) : hasSections ? (
            <Stack gap="md">
              {sections.map((section, sectionIndex) => (
                <Paper key={section.id} p="md" withBorder bg="gray.0">
                  <Group justify="space-between" mb="sm">
                    <div>
                      <Group gap="sm">
                        <Badge>Sektion {sectionIndex + 1}</Badge>
                        <Text fw={600}>{section.title}</Text>
                      </Group>
                      {section.description && (
                        <Text size="sm" c="dimmed" mt="xs">{section.description}</Text>
                      )}
                    </div>
                    <Badge color="blue">
                      {section.questions.reduce((sum, q) => sum + q.points, 0)} Punkte
                    </Badge>
                  </Group>
                  <Stack gap="xs">
                    {section.questions.map((question, index) => (
                      <Paper key={question.id} p="sm" bg="white" withBorder>
                        <Group justify="space-between">
                          <Group gap="sm">
                            <Text size="sm" fw={500}>
                              {index + 1}. {question.title}
                            </Text>
                            <Badge size="xs">
                              {question.type === 'multiple_choice' ? 'MC' :
                               question.type === 'free_text' ? 'Text' : 'Datei'}
                            </Badge>
                          </Group>
                          <Badge variant="outline" size="sm">
                            {question.points} {question.points === 1 ? 'Punkt' : 'Punkte'}
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Stack gap="sm">
              {exam.questions.map((question, index) => (
                <Paper key={question.id} p="sm" bg="gray.0">
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Text size="sm" fw={500}>
                        {index + 1}. {question.title}
                      </Text>
                      <Badge size="xs">
                        {question.type === 'multiple_choice' ? 'MC' :
                         question.type === 'free_text' ? 'Text' : 'Datei'}
                      </Badge>
                    </Group>
                    <Badge variant="outline" size="sm">
                      {question.points} {question.points === 1 ? 'Punkt' : 'Punkte'}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>

      {exam.status === 'draft' && id && (
        <SendInvitationsModal
          opened={showInvitationModal}
          onClose={() => setShowInvitationModal(false)}
          examId={id}
          examTitle={exam.title}
          onActivate={doActivate}
        />
      )}
    </Container>
  );
};
