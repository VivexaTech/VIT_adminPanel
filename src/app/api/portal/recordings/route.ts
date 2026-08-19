import { NextRequest, NextResponse } from "next/server";
import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecordingVideo = {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
};

function getAdminDb() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID;

    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    const privateKey =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      );

    if (
      !projectId ||
      !clientEmail ||
      !privateKey
    ) {
      throw new Error(
        "Firebase Admin environment variables are missing."
      );
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getFirestore();
}

function getPlaylistId(
  playlistUrl: string
): string | null {
  try {
    const url = new URL(
      playlistUrl.trim()
    );

    return (
      url.searchParams.get("list")?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    // -----------------------------------------
    // 1. Get batch ID
    // -----------------------------------------

    const batchId =
      request.nextUrl.searchParams
        .get("batchId")
        ?.trim();

    if (!batchId) {
      return NextResponse.json(
        {
          error:
            "Batch ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // 2. Firebase Admin
    // -----------------------------------------

    const db = getAdminDb();

    // -----------------------------------------
    // 3. Find batch
    // -----------------------------------------

    let batchData:
      | Record<string, any>
      | null = null;

    // Try document ID first
    const directBatch = await db
      .collection("batches")
      .doc(batchId)
      .get();

    if (directBatch.exists) {
      batchData =
        directBatch.data() || null;
    }

    // If document ID doesn't match,
    // search by batchId field
    if (!batchData) {
      const querySnapshot = await db
        .collection("batches")
        .where(
          "batchId",
          "==",
          batchId
        )
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        batchData =
          querySnapshot.docs[0].data();
      }
    }

    if (!batchData) {
      return NextResponse.json(
        {
          error: "Batch not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // 4. Get playlist URL
    // -----------------------------------------

    const playlistUrl = String(
      batchData.playlistUrl ??
        batchData.youtubePlaylistUrl ??
        batchData.youtubePlaylist ??
        ""
    ).trim();

    if (!playlistUrl) {
      return NextResponse.json(
        {
          error:
            "No recording playlist is configured for this batch.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------
    // 5. Get playlist ID
    // -----------------------------------------

    const playlistId =
      getPlaylistId(playlistUrl);

    if (!playlistId) {
      return NextResponse.json(
        {
          error:
            "Invalid YouTube playlist URL.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // 6. YouTube API key
    // -----------------------------------------

    const apiKey =
      process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.error(
        "YOUTUBE_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "YouTube API is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------
    // 7. Fetch playlist videos
    // -----------------------------------------

    const videos: RecordingVideo[] = [];

    /*
     * Prevent duplicate videos.
     *
     * YouTube playlist can sometimes contain
     * the same video more than once.
     */
    const seenVideoIds =
      new Set<string>();

    let nextPageToken = "";

    do {
      const params =
        new URLSearchParams({
          part:
            "snippet,contentDetails",
          playlistId,
          maxResults: "50",
          key: apiKey,
        });

      if (nextPageToken) {
        params.set(
          "pageToken",
          nextPageToken
        );
      }

      const youtubeResponse =
        await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      /*
       * Don't directly call response.json()
       * without checking the response.
       */
      const responseText =
        await youtubeResponse.text();

      let youtubeData: any = null;

      try {
        youtubeData =
          responseText
            ? JSON.parse(responseText)
            : null;
      } catch {
        console.error(
          "Invalid YouTube API response:",
          responseText.slice(0, 500)
        );

        return NextResponse.json(
          {
            error:
              "YouTube returned an invalid response.",
          },
          {
            status: 502,
          }
        );
      }

      // ---------------------------------------
      // YouTube API error
      // ---------------------------------------

      if (!youtubeResponse.ok) {
        console.error(
          "YouTube API error:",
          youtubeData
        );

        return NextResponse.json(
          {
            error:
              youtubeData?.error?.message ||
              "YouTube API request failed.",
          },
          {
            status:
              youtubeResponse.status || 500,
          }
        );
      }

      // ---------------------------------------
      // Playlist items
      // ---------------------------------------

      const items =
        Array.isArray(
          youtubeData?.items
        )
          ? youtubeData.items
          : [];

      for (const item of items) {
        const videoId =
  item?.contentDetails?.videoId;

const videoTitle =
  item?.snippet?.title || "";

if (!videoId) {
  continue;
}

// Private / deleted videos hide
if (
  videoTitle === "Private video" ||
  videoTitle === "Deleted video"
) {
  continue;
}

        const id = String(videoId);

        /*
         * Skip duplicate video IDs.
         */
        if (seenVideoIds.has(id)) {
          continue;
        }

        seenVideoIds.add(id);

        const title = String(
          item?.snippet?.title ||
            "Class Recording"
        );

        const thumbnail = String(
          item?.snippet?.thumbnails
            ?.high?.url ||
            item?.snippet?.thumbnails
              ?.medium?.url ||
            item?.snippet?.thumbnails
              ?.default?.url ||
            ""
        );

        const publishedAt = String(
          item?.snippet?.publishedAt ||
            ""
        );

        videos.push({
          id,
          title,
          thumbnail,
          publishedAt,
        });
      }

      nextPageToken =
        youtubeData?.nextPageToken ||
        "";
    } while (nextPageToken);

    // -----------------------------------------
    // 8. Return safe data only
    // -----------------------------------------

    return NextResponse.json(
      {
        videos,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Recordings API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      {
        status: 500,
      }
    );
  }
}