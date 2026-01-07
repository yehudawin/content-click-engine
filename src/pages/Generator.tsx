import { useState } from "react";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelSelector } from "@/components/ChannelSelector";
import { CampaignSelector } from "@/components/CampaignSelector";
import { GeneratedBlock } from "@/components/GeneratedBlock";
import { useChannels } from "@/hooks/useChannels";
import { useCreateDubLink } from "@/hooks/useDubApi";
import { useCreateGeneratedLink } from "@/hooks/useGeneratedLinks";
import { LinkGenerationSchema } from "@/lib/validation";

interface GeneratedBlockData {
  channelId: string;
  channelName: string;
  channelColor: string;
  adCopy: string;
  shortLink: string;
}

export default function Generator() {
  const [adCopy, setAdCopy] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://example.com");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [generatedBlocks, setGeneratedBlocks] = useState<GeneratedBlockData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useChannels();
  const createDubLink = useCreateDubLink();
  const createGeneratedLink = useCreateGeneratedLink();

  const handleGenerate = async () => {
    // Validate inputs
    const result = LinkGenerationSchema.safeParse({
      destinationUrl: destinationUrl.trim(),
      adCopy: adCopy.trim(),
    });

    if (!result.success) {
      toast.error(result.error.errors[0]?.message || "קלט לא תקין");
      return;
    }

    if (selectedChannels.length === 0) {
      toast.error("נא לבחור לפחות ערוץ אחד");
      return;
    }

    setIsGenerating(true);
    setGeneratedBlocks([]);

    const newBlocks: GeneratedBlockData[] = [];

    for (const channelId of selectedChannels) {
      const channel = channels?.find((c) => c.id === channelId);
      if (!channel) continue;

      try {
        // Build URL with UTM parameters
        const url = new URL(result.data.destinationUrl);
        url.searchParams.set("utm_source", channel.name.toLowerCase().replace(/\s+/g, "_"));
        url.searchParams.set("utm_medium", "social");
        url.searchParams.set("utm_campaign", selectedCampaign ? "campaign" : "general");

        // Create short link via Dub.co
        const dubLink = await createDubLink.mutateAsync({
          url: url.toString(),
          tags: [channel.name],
        });

        // Save to database
        await createGeneratedLink.mutateAsync({
          channel_id: channelId,
          campaign_id: selectedCampaign || undefined,
          short_link: dubLink.shortLink,
          destination_url: url.toString(),
          ad_copy: result.data.adCopy,
          dub_link_id: dubLink.id,
        });

        newBlocks.push({
          channelId,
          channelName: channel.name,
          channelColor: channel.color,
          adCopy: result.data.adCopy,
          shortLink: dubLink.shortLink,
        });

        // Update UI progressively
        setGeneratedBlocks([...newBlocks]);
      } catch (error) {
        console.error(`Error creating link for ${channel.name}:`, error);
        toast.error(`נכשל ביצירת לינק ל-${channel.name}`);
      }
    }

    setIsGenerating(false);
    if (newBlocks.length > 0) {
      toast.success(`נוצרו ${newBlocks.length} לינקים מעוקבים!`);
    }
  };

  const handleCopyAll = async () => {
    const allText = generatedBlocks
      .map((block) => `--- ${block.channelName} ---\n${block.adCopy}\n\n${block.shortLink}`)
      .join("\n\n\n");

    try {
      await navigator.clipboard.writeText(allText);
      toast.success("כל הבלוקים הועתקו ללוח!");
    } catch (err) {
      toast.error("ההעתקה נכשלה");
    }
  };

  return (
    <div className="min-h-screen lg:pr-0 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            יצירת קישורים
          </h1>
          <p className="text-muted-foreground">
            צרו לינקים מעוקבים לקמפיינים השיווקיים שלכם
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-card rounded-2xl border border-border p-4 lg:p-6 shadow-sm mb-8">
          <div className="space-y-6">
            {/* Campaign Selector */}
            <CampaignSelector
              selectedCampaign={selectedCampaign}
              onSelect={setSelectedCampaign}
            />

            {/* Destination URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                כתובת יעד
              </label>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://your-landing-page.com"
                dir="ltr"
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-left"
              />
            </div>

            {/* Ad Copy */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                טקסט פרסומי
              </label>
              <textarea
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                placeholder="הזינו כאן את הטקסט הפרסומי שלכם..."
                rows={5}
                maxLength={5000}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {adCopy.length}/5000 תווים
              </p>
            </div>

            {/* Channel Selector */}
            <ChannelSelector
              channels={channels || []}
              selectedChannels={selectedChannels}
              onSelectionChange={setSelectedChannels}
              isLoading={channelsLoading}
            />

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !adCopy.trim() || selectedChannels.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-primary/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  יוצר...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  צור בלוקים
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Blocks */}
        {generatedBlocks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                בלוקים מוכנים לפרסום
              </h2>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
              >
                <Copy className="h-4 w-4" />
                העתק הכל
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {generatedBlocks.map((block, index) => (
                <GeneratedBlock
                  key={block.channelId}
                  channelName={block.channelName}
                  channelColor={block.channelColor}
                  adCopy={block.adCopy}
                  shortLink={block.shortLink}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
