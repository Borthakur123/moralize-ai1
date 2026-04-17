import { useListAnnotations, useListCoders } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Filter, Download } from "lucide-react";

export default function Annotations() {
  const [coderIdStr, setCoderIdStr] = useState<string>("all");
  const [downloading, setDownloading] = useState(false);
  
  const queryParams = coderIdStr !== "all" ? { coderId: parseInt(coderIdStr) } : undefined;
  
  const { data: annotations, isLoading } = useListAnnotations(queryParams);
  const { data: coders } = useListCoders();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/annotations/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `moralize-ai-annotations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annotations</h1>
          <p className="text-muted-foreground mt-1">Review completed coding assignments across the corpus.</p>
        </div>
        <Button onClick={handleDownload} disabled={downloading} variant="outline" className="gap-2 shrink-0">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download CSV
        </Button>
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
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead className="w-[80px]">Post</TableHead>
              <TableHead className="w-[160px]">Coder</TableHead>
              <TableHead>Anthro / Mind / Moral</TableHead>
              <TableHead className="w-[200px]">MDMT Trust Cues</TableHead>
              <TableHead className="w-[100px]">Uncanny</TableHead>
              <TableHead className="w-[120px] text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : annotations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No annotations found.
                </TableCell>
              </TableRow>
            ) : (
              annotations?.map((ann) => {
                const capacityTrust = [ann.mdmtReliable, ann.mdmtCapable].filter(Boolean);
                const moralTrust = [ann.mdmtEthical, ann.mdmtSincere].filter(Boolean);
                const capacityLabels = [ann.mdmtReliable && "Reliable", ann.mdmtCapable && "Capable"].filter(Boolean);
                const moralLabels = [ann.mdmtEthical && "Ethical", ann.mdmtSincere && "Sincere"].filter(Boolean);
                return (
                  <TableRow key={ann.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ann.id}</TableCell>
                    <TableCell className="font-mono text-xs">{ann.postId}</TableCell>
                    <TableCell className="font-medium text-sm">{ann.coderName || `Coder ${ann.coderId}`}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="outline" className={ann.anthropomorphismLevel === 'strong' ? 'border-primary text-primary text-xs' : 'text-xs'}>
                          A: {ann.anthropomorphismLevel}
                        </Badge>
                        <Badge variant="outline" className={ann.mindPerception !== 'neither' ? 'border-primary text-primary text-xs' : 'text-xs'}>
                          M: {ann.mindPerception}
                        </Badge>
                        <Badge variant="outline" className={
                          ann.moralEvaluation === 'blame' || ann.moralEvaluation === 'concern' ? 'border-destructive text-destructive text-xs' : 
                          ann.moralEvaluation === 'praise' ? 'border-emerald-500 text-emerald-600 text-xs' : 'text-xs'
                        }>
                          E: {ann.moralEvaluation}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {capacityTrust.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {capacityLabels.map(label => (
                              <Badge key={label as string} variant="secondary" className="text-xs py-0">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {moralTrust.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {moralLabels.map(label => (
                              <Badge key={label as string} className="text-xs py-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 border-0">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {capacityTrust.length === 0 && moralTrust.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ann.uncanny !== 'none' ? (
                        <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">{ann.uncanny}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
