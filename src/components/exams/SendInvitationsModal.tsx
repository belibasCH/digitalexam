import { useState } from 'react';
import {
  Modal,
  Stack,
  Textarea,
  Button,
  Group,
  Text,
  Badge,
  Alert,
  List,
} from '@mantine/core';
import { IconMail, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useSendExamInvitationsMutation } from '../../services/exams/examsApi';

interface SendInvitationsModalProps {
  opened: boolean;
  onClose: () => void;
  examId: string;
  examTitle: string;
  onActivate: () => Promise<void>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (input: string): string[] => {
  return input
    .split(/[,;\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
};

export const SendInvitationsModal = ({
  opened,
  onClose,
  examId,
  examTitle,
  onActivate,
}: SendInvitationsModalProps) => {
  const [emailInput, setEmailInput] = useState('');
  const [result, setResult] = useState<{ sent: string[]; failed: string[] } | null>(null);
  const [activating, setActivating] = useState(false);
  const [sendExamInvitations, { isLoading: sending }] = useSendExamInvitationsMutation();

  const emails = parseEmails(emailInput);
  const validEmails = emails.filter((e) => EMAIL_REGEX.test(e));
  const invalidEmails = emails.filter((e) => !EMAIL_REGEX.test(e));

  const handleSend = async () => {
    if (validEmails.length === 0) return;

    setActivating(true);
    try {
      // First activate the exam
      await onActivate();

      // Then send invitations
      const res = await sendExamInvitations({
        exam_id: examId,
        emails: validEmails,
        exam_title: examTitle,
      }).unwrap();

      setResult(res);
    } catch {
      setResult({ sent: [], failed: validEmails });
    } finally {
      setActivating(false);
    }
  };

  const handleSkip = async () => {
    setActivating(true);
    try {
      await onActivate();
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setActivating(false);
    }
  };

  const handleClose = () => {
    setEmailInput('');
    setResult(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Prüfung aktivieren & Einladungen senden"
      size="lg"
    >
      {result ? (
        <Stack gap="md">
          <Alert
            color={result.failed.length === 0 ? 'green' : 'orange'}
            icon={result.failed.length === 0 ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          >
            {result.sent.length > 0 && (
              <Text size="sm">
                {result.sent.length} E-Mail(s) erfolgreich gesendet.
              </Text>
            )}
            {result.failed.length > 0 && (
              <Text size="sm" c="red">
                {result.failed.length} E-Mail(s) konnten nicht gesendet werden.
              </Text>
            )}
          </Alert>

          {result.sent.length > 0 && (
            <div>
              <Text size="sm" fw={500} mb="xs">Erfolgreich:</Text>
              <List size="sm" spacing="xs">
                {result.sent.map((email) => (
                  <List.Item key={email} icon={<IconCheck size={14} color="green" />}>
                    {email}
                  </List.Item>
                ))}
              </List>
            </div>
          )}

          {result.failed.length > 0 && (
            <div>
              <Text size="sm" fw={500} mb="xs">Fehlgeschlagen:</Text>
              <List size="sm" spacing="xs">
                {result.failed.map((email) => (
                  <List.Item key={email} icon={<IconX size={14} color="red" />}>
                    {email}
                  </List.Item>
                ))}
              </List>
            </div>
          )}

          <Group justify="flex-end">
            <Button onClick={handleClose}>Schliessen</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Geben Sie die E-Mail-Adressen der Schüler ein, die eine Einladung erhalten sollen.
            Die Prüfung wird zuerst aktiviert, dann werden die Einladungen versendet.
          </Text>

          <Textarea
            label="E-Mail-Adressen"
            placeholder="max@example.com&#10;anna@example.com&#10;..."
            description="Getrennt durch Komma, Semikolon oder Zeilenumbruch"
            minRows={5}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />

          <Group gap="sm">
            {validEmails.length > 0 && (
              <Badge color="green" variant="light">
                {validEmails.length} gültige E-Mail(s)
              </Badge>
            )}
            {invalidEmails.length > 0 && (
              <Badge color="red" variant="light">
                {invalidEmails.length} ungültige E-Mail(s)
              </Badge>
            )}
          </Group>

          {invalidEmails.length > 0 && (
            <Alert color="orange" icon={<IconAlertCircle size={16} />}>
              <Text size="sm">Ungültige Adressen: {invalidEmails.join(', ')}</Text>
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={handleSkip}
              loading={activating && !sending}
            >
              Überspringen
            </Button>
            <Button
              leftSection={<IconMail size={16} />}
              onClick={handleSend}
              loading={sending || activating}
              disabled={validEmails.length === 0}
            >
              Einladungen senden
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};
