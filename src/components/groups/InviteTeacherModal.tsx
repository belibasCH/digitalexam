import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
} from '@mantine/core';
import { IconMail } from '@tabler/icons-react';

interface InviteTeacherModalProps {
  opened: boolean;
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
  loading?: boolean;
}

export const InviteTeacherModal = ({
  opened,
  onClose,
  onInvite,
  loading,
}: InviteTeacherModalProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  const handleInvite = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError('Bitte geben Sie eine E-Mail-Adresse ein.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setError('');
    await onInvite(email.trim().toLowerCase());
    setEmail('');
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Lehrer einladen"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Geben Sie die E-Mail-Adresse des Lehrers ein, den Sie zur Gruppe einladen möchten.
          Der Lehrer muss bereits ein Konto haben, um die Einladung annehmen zu können.
        </Text>

        <TextInput
          label="E-Mail-Adresse"
          placeholder="lehrer@schule.de"
          leftSection={<IconMail size={16} />}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          error={error}
          required
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button onClick={handleInvite} loading={loading}>
            Einladen
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
