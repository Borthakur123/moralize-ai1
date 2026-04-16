import { useListAnnotations, useListCoders } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Filter } from "lucide-react";

export default function Annotations() {
  const [coderIdStr, setCoderIdStr] = useState<string>("all");
  
  const queryParams = coderIdStr !== "all" ? { coderId: parseInt(coderIdStr) } : undefined;
  
  const { data: annotations, isLoading } = useListAnnotations(queryParams);
  const { data: coders } = useListCoders();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annotations</h1>
          <p className="text-muted-foreground mt-1">Review completed coding assignments across the corpus.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filter by Coder:
        </div>
        <Select value={coderIdStr} onValueChange={setCoderIdStr}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="All Coders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coders</SelectItem>
            {coders?.map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[100px]">Post ID</TableHead>
              <TableHead className="w-[150px]">Coder</TableHead>
              <TableHead>Dimensions (Anthro / Mind / Moral)</TableHead>
              <TableHead className="w-[150px]">VASS Cues</TableHead>
              <TableHead className="w-[150px] text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : annotations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No annotations found.
                </TableCell>
              </TableRow>
            ) : (
              annotations?.map((ann) => {
                const vassCount = [ann.vassValues, ann.vassAutonomy, ann.vassSocialConnection, ann.vassSelfAwareEmotions].filter(Boolean).length;
                return (
                  <TableRow key={ann.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ann.id}</TableCell>
                    <TableCell className="font-mono text-xs">{ann.postId}</TableCell>
                    <TableCell className="font-medium">{ann.coderName || `Coder ${ann.coderId}`}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={ann.anthropomorphismLevel === 'strong' ? 'border-primary text-primary' : ''}>
                          A: {ann.anthropomorphismLevel}
                        </Badge>
                        <Badge variant="outline" className={ann.mindPerception !== 'neither' ? 'border-primary text-primary' : ''}>
                          M: {ann.mindPerception}
                        </Badge>
                        <Badge variant="outline" className={
                          ann.moralEvaluation === 'blame' || ann.moralEvaluation === 'concern' ? 'border-destructive text-destructive' : 
                          ann.moralEvaluation === 'praise' ? 'border-emerald-500 text-emerald-600' : ''
                        }>
                          E: {ann.moralEvaluation}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {vassCount > 0 ? (
                        <Badge variant="secondary">{vassCount} Cues</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(ann.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
