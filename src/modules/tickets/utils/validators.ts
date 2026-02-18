import type {
  CreateTicketErrors,
  CreateTicketFormValues,
} from "../types/createTicket";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(String(value).trim());
}

export function validateCreateTicket(values: CreateTicketFormValues): CreateTicketErrors {
  const errors: CreateTicketErrors = {};

  if (values.subject.trim().length < 3) {
    errors.subject = "El asunto debe tener al menos 3 caracteres.";
  }

  if (!isValidEmail(values.requesterEmail)) {
    errors.requesterEmail = "Ingresa un correo valido.";
  }

  if (!values.area) {
    errors.area = "Selecciona un area.";
  }

  if (!values.type) {
    errors.type = "Selecciona un tipo.";
  }

  if (!values.priority) {
    errors.priority = "Selecciona una prioridad.";
  }

  if (values.description.trim().length < 5) {
    errors.description = "La descripcion debe tener al menos 5 caracteres.";
  }

  return errors;
}
