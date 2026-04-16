import { useListCoders, useCreateCoder, getListCodersQueryKey, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address.").optional().or(z.literal("")),
  role: z.enum(["lead", "coder"]),
});

export default function Coders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: coders, isLoading } = useListCoders();
  const createCoder = useCreateCoder();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "coder",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCoder.mutate({
      data: values
    }, {
      onSuccess: () => {
        toast({ title: "Coder created successfully" });
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListCodersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Error creating coder",
          description: String(err),
        });
      }
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Research Team</h1>
        <p className="text-muted-foreground mt-1">Manage annotators and track their coding progress.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 items-start">
        <div className="md:col-span-2">
          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Completed Codes</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : coders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No coders found. Add one to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  coders?.map((coder) => (
                    <TableRow key={coder.id}>
                      <TableCell>
                        <div className="font-medium">{coder.name}</div>
                        {coder.email && <div className="text-xs text-muted-foreground">{coder.email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={coder.role === 'lead' ? 'default' : 'secondary'}>
                          {coder.role === 'lead' ? 'Lead Researcher' : 'Annotator'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {coder.annotationCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(coder.createdAt), 'MMM yyyy')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Team Member
            </CardTitle>
            <CardDescription>Create a new coder profile for the study.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="jane@university.edu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="coder">Annotator</SelectItem>
                          <SelectItem value="lead">Lead Researcher</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createCoder.isPending}>
                  {createCoder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Profile
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
