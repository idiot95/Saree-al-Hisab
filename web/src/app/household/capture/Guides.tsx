'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '../../Icon';

/* How to make a phone forward bank messages here, one tab per kind of phone. The steps name the exact screens and
   fields, because a person follows them with the phone in the other hand; and each permission is said in plain words,
   because it is a permission to read messages. No paid app is named: the iPhone needs only Shortcuts, which comes with
   it, and on Android any forwarder that can send JSON with a header will do — the open-source "SMS to URL Forwarder"
   is the example. */

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex list-none flex-col gap-3 p-0 [counter-reset:step]">{children}</ol>;
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed [counter-increment:step] before:grid before:size-7 before:flex-none before:place-items-center before:rounded-full before:bg-muted before:text-xs before:font-bold before:content-[counter(step)]">
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] [overflow-wrap:anywhere]">{children}</code>
);

function Permission({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed">
      <Icon name="info" size={18} className="mt-0.5 text-muted-foreground" />
      <span>{children}</span>
    </p>
  );
}

export default function Guides({ endpoint }: { endpoint: string }) {
  return (
    <Tabs defaultValue="iphone" className="gap-4">
      <TabsList aria-label="Kind of phone" className="grid h-auto w-full grid-cols-2 gap-1 rounded-[14px] p-1">
        <TabsTrigger value="iphone" className="min-h-11 gap-1.5 rounded-[11px] text-sm font-semibold data-[state=active]:bg-raised in-data-[platform=android]:min-h-12">
          <Icon name="phone_iphone" size={18} /> iPhone
        </TabsTrigger>
        <TabsTrigger value="android" className="min-h-11 gap-1.5 rounded-[11px] text-sm font-semibold data-[state=active]:bg-raised in-data-[platform=android]:min-h-12">
          <Icon name="android" size={18} /> Android
        </TabsTrigger>
      </TabsList>

      <TabsContent value="iphone" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          With the Shortcuts app, which comes with every iPhone. About five minutes.
        </p>
        <Steps>
          <Step>Open <b>Shortcuts</b>, tap <b>Automation</b> at the bottom, then <b>New Automation</b> (or <b>+</b>).</Step>
          <Step>Choose <b>Message</b>.</Step>
          <Step>
            Tap <b>Sender</b> and add your bank as it appears in Messages — for example <Code>HDFCBK</Code> or{' '}
            <Code>ICICIT</Code>. Add every bank you want recorded. Only messages from these senders are sent.
          </Step>
          <Step>Choose <b>Run Immediately</b>, so it does not ask each time, then tap <b>Next</b>.</Step>
          <Step>Tap <b>New Blank Automation</b>, then <b>Add Action</b>, and search for <b>Get Contents of URL</b>.</Step>
          <Step>Tap <b>URL</b> and paste the address: <Code>{endpoint}</Code></Step>
          <Step>
            Tap the arrow beside the action to show more. Set <b>Method</b> to <b>POST</b>.
          </Step>
          <Step>
            Under <b>Headers</b>, tap <b>Add new header</b>. Key: <Code>Authorization</Code>. Value: <Code>Bearer </Code> followed
            by this phone’s key, with one space between them.
          </Step>
          <Step>
            Set <b>Request Body</b> to <b>JSON</b> and add two fields, both of type <b>Text</b>:
            <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
              <li>Key <Code>text</Code> — for the value, tap <b>Shortcut Input</b> and choose <b>Message</b>.</li>
              <li>Key <Code>sender</Code> — tap <b>Shortcut Input</b> and choose <b>Sender</b>.</li>
            </ul>
          </Step>
          <Step>Tap <b>Done</b>. The next message from your bank appears under To review, From SMS.</Step>
        </Steps>
        <Permission>
          The automation reads only messages from the senders you chose, as they arrive, and sends each to this app’s
          address. Nothing else on the phone is read. Delete the automation, or revoke the key here, to stop it.
        </Permission>
      </TabsContent>

      <TabsContent value="android" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          With an app that forwards text messages to an address. Any free one that can send JSON with a header works; these
          steps use the open-source <b>SMS to URL Forwarder</b>, from F-Droid or Google Play.
        </p>
        <Steps>
          <Step>Install <b>SMS to URL Forwarder</b> and open it.</Step>
          <Step>
            When it asks to <b>receive SMS</b>, allow it. Without this it cannot see a message arrive.
          </Step>
          <Step>Tap <b>+</b> to add a forwarding rule.</Step>
          <Step>
            For <b>Sender</b>, type your bank as it appears in Messages — for example <Code>HDFCBK</Code>. Add one rule per
            bank. Avoid <Code>*</Code> (every sender): that would send your personal messages too.
          </Step>
          <Step>For the <b>URL</b>, paste the address: <Code>{endpoint}</Code></Step>
          <Step>
            For the <b>message template</b>, enter exactly: <Code>{'{"text":"%text%","sender":"%from%"}'}</Code>
          </Step>
          <Step>
            For <b>headers</b>, enter: <Code>{'{"Authorization":"Bearer '}</Code> followed by this phone’s key, then{' '}
            <Code>{'"}'}</Code>.
          </Step>
          <Step>Save the rule. The next message from your bank appears under To review, From SMS.</Step>
          <Step>
            If messages stop arriving after a while, open the phone’s <b>Settings › Apps › SMS to URL Forwarder › Battery</b>{' '}
            and choose <b>Unrestricted</b>, so the phone does not put it to sleep.
          </Step>
        </Steps>
        <Permission>
          <b>Receive SMS</b> lets the app see each text message as it arrives; it forwards only those matching a rule, to
          the address you gave. It does not send texts or read your contacts. Uninstall it, or revoke the key here, to
          stop it.
        </Permission>
      </TabsContent>
    </Tabs>
  );
}
