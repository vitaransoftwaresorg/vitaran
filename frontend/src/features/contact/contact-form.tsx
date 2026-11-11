"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Form from "next/form";
import { CheckCircle2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { interests } from "./content";

const CONTROL = "h-11 rounded-xl";

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [interest, setInterest] = useState("");

  const onFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
    event.target.value = "";
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const onCancel = () => {
    formRef.current?.reset();
    setFiles([]);
    setInterest("");
  };

  const submitContact = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="flex min-h-96 items-center justify-center rounded-3xl py-8 text-center shadow-2xl ring-0">
        <CardContent className="flex flex-col items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-800">
            <CheckCircle2 className="size-7" />
          </div>
          <h3 className="mt-5 text-2xl font-bold">Thank you!</h3>
          <p className="mt-2 max-w-xs text-muted-foreground">
            We&apos;ve received your request and will be in touch soon.
          </p>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              onCancel();
              setSubmitted(false);
            }}
            className="mt-6 text-brand-700"
          >
            Send another message
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl py-6 shadow-2xl ring-0 sm:py-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Drop us a line!</CardTitle>
      </CardHeader>
      <CardContent>
        <Form ref={formRef} action={submitContact} className="space-y-5">
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-name">
                  Name <span className="text-brand-500">*</span>
                </FieldLabel>
                <Input
                  id="contact-name"
                  name="name"
                  required
                  autoComplete="name"
                  className={CONTROL}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-email">
                  Work Email <span className="text-brand-500">*</span>
                </FieldLabel>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={CONTROL}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contact-org">
                  School / Organisation <span className="text-brand-500">*</span>
                </FieldLabel>
                <Input
                  id="contact-org"
                  name="organisation"
                  required
                  autoComplete="organization"
                  className={CONTROL}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
                <Input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className={CONTROL}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="contact-interest">Interested in</FieldLabel>
              <Select
                name="interest"
                items={interests.map((item) => ({ value: item, label: item }))}
                value={interest || null}
                onValueChange={(value) => setInterest(String(value ?? ""))}
              >
                <SelectTrigger id="contact-interest" className={`${CONTROL} w-full`}>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {interests.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="contact-message">Message</FieldLabel>
              <Textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder="Tell us about your requirements…"
                className="min-h-24 rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel>Attach Files</FieldLabel>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-auto w-full gap-2 rounded-xl border-dashed border-brand-200 bg-brand-50/50 py-5 text-brand-700 hover:border-brand-400 hover:bg-brand-50"
              >
                <Paperclip className="size-4" />
                Choose files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFilesChange}
                className="sr-only"
                tabIndex={-1}
              />
              <p className="text-xs text-muted-foreground">Attachments ({files.length})</p>
              {files.length > 0 ? (
                <ul className="space-y-2">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${file.name}`}
                        className="text-brand-500 hover:bg-brand-100 hover:text-brand-800"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="h-11 flex-1 rounded-full"
              >
                Cancel
              </Button>
              <Button type="submit" className="group h-11 flex-1 rounded-full bg-brand-800 hover:bg-brand-700">
                Send
                <Send className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </div>
          </FieldGroup>
        </Form>
      </CardContent>
    </Card>
  );
}
