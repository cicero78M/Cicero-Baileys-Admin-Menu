import * as linkReportModel from '../model/linkReportKhususModel.js';
import { findUserByIdAndClient } from '../model/userModel.js';
import { sendConsoleDebug } from '../middleware/debugHandler.js';
import { sendSuccess } from '../utils/response.js';
import { extractFirstUrl, extractInstagramShortcode } from '../utils/utilsHelper.js';
import { fetchSinglePostKhusus } from '../handler/fetchpost/instaFetchPost.js';

function rejectWithReason(reasonCode, message, statusCode = 400, context = {}) {
  sendConsoleDebug({
    tag: 'LINK_REPORT_KHUSUS',
    msg: `createLinkReport rejected: ${reasonCode}`,
    obj: context
  });
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export async function getAllLinkReports(req, res, next) {
  try {
    const userId = req.query.user_id;
    const postId = req.query.post_id || req.query.shortcode;
    const data = await linkReportModel.getLinkReports({ userId, postId });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getLinkReportByShortcode(req, res, next) {
  try {
    const report = await linkReportModel.findLinkReportByShortcode(
      req.params.shortcode,
      req.query.user_id
    );
    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function createLinkReport(req, res, next) {
  try {
    const data = { ...req.body };
    const requester = req.user;
    const role = requester?.role ? String(requester.role).toLowerCase() : null;

    if (!requester || !requester.user_id) {
      rejectWithReason('AUTH_CONTEXT_MISSING', 'unauthorized', 401, {
        hasUserObject: Boolean(requester)
      });
    }
    
    // Validate required fields first (fail fast)
    if (!data.client_id) {
      rejectWithReason('CLIENT_ID_REQUIRED', 'client_id is required', 400, {
        requesterUserId: requester.user_id
      });
    }
    
    // Validate that Instagram link is provided
    if (!data.instagram_link) {
      rejectWithReason('INSTAGRAM_LINK_REQUIRED', 'instagram_link is required', 400, {
        requesterUserId: requester.user_id,
        clientId: data.client_id
      });
    }
    
    // Extract and validate Instagram link format
    const instagramLink = extractFirstUrl(data.instagram_link);
    if (!instagramLink) {
      rejectWithReason('INSTAGRAM_LINK_INVALID_URL', 'instagram_link must be a valid URL', 400, {
        requesterUserId: requester.user_id,
        clientId: data.client_id
      });
    }
    
    const shortcode = extractInstagramShortcode(instagramLink);
    if (!shortcode) {
      rejectWithReason(
        'INSTAGRAM_LINK_INVALID_SHORTCODE',
        'instagram_link must be a valid Instagram post URL',
        400,
        {
          requesterUserId: requester.user_id,
          clientId: data.client_id
        }
      );
    }
    
    // Ensure no other social media links are provided
    const otherLinks = ['facebook_link', 'twitter_link', 'tiktok_link', 'youtube_link'];
    const hasOtherLinks = otherLinks.some(field => data[field]);
    if (hasOtherLinks) {
      rejectWithReason(
        'UNSUPPORTED_SOCIAL_LINKS',
        'Only instagram_link is allowed for special assignment uploads',
        400,
        {
          requesterUserId: requester.user_id,
          clientId: data.client_id
        }
      );
    }

    if (role === 'user') {
      data.user_id = requester.user_id;
    } else {
      const targetUserId = data.target_user_id;
      if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
        rejectWithReason(
          'TARGET_USER_ID_INVALID',
          'target_user_id is required for non-user role',
          400,
          {
            requesterUserId: requester.user_id,
            requesterRole: role,
            clientId: data.client_id
          }
        );
      }

      const targetUser = await findUserByIdAndClient(targetUserId, data.client_id);
      if (!targetUser) {
        rejectWithReason(
          'TARGET_USER_ID_CLIENT_MISMATCH',
          'target_user_id is invalid or does not belong to the same client_id',
          403,
          {
            requesterUserId: requester.user_id,
            requesterRole: role,
            clientId: data.client_id,
            targetUserId
          }
        );
      }

      data.user_id = targetUser.user_id;
    }

    if (!data.user_id) {
      rejectWithReason('RESOLVED_USER_ID_EMPTY', 'user_id could not be resolved', 400, {
        requesterUserId: requester.user_id,
        requesterRole: role,
        clientId: data.client_id
      });
    }
    
    // Fetch and store Instagram post metadata via RapidAPI
    // The stored data will be referenced by createLinkReport using the shortcode
    await fetchSinglePostKhusus(instagramLink, data.client_id);
    
    // Create link report with validated Instagram link
    data.instagram_link = instagramLink;
    data.shortcode = shortcode;
    data.target_user_id = null;
    data.facebook_link = null;
    data.twitter_link = null;
    data.tiktok_link = null;
    data.youtube_link = null;
    
    const report = await linkReportModel.createLinkReport(data);
    sendSuccess(res, report, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateLinkReport(req, res, next) {
  try {
    const bodyData = { ...req.body };
    
    // Extract Instagram link from payload
    const instagramLink = bodyData.instagram_link ? extractFirstUrl(bodyData.instagram_link) : null;
    
    // Validate that the link is a valid Instagram post link if provided
    if (instagramLink) {
      const shortcode = extractInstagramShortcode(instagramLink);
      if (!shortcode) {
        const error = new Error('instagram_link must be a valid Instagram post URL');
        error.statusCode = 400;
        throw error;
      }
      bodyData.instagram_link = instagramLink;
    }
    
    // Ensure no other social media links are provided for special assignments
    const otherLinks = ['facebook_link', 'twitter_link', 'tiktok_link', 'youtube_link'];
    const hasOtherLinks = otherLinks.some(field => bodyData[field]);
    if (hasOtherLinks) {
      const error = new Error('Only instagram_link is allowed for special assignment updates');
      error.statusCode = 400;
      throw error;
    }
    
    // Set other social media links to null
    bodyData.facebook_link = null;
    bodyData.twitter_link = null;
    bodyData.tiktok_link = null;
    bodyData.youtube_link = null;
    
    const report = await linkReportModel.updateLinkReport(
      req.params.shortcode,
      bodyData.user_id,
      bodyData
    );
    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}

export async function deleteLinkReport(req, res, next) {
  try {
    const report = await linkReportModel.deleteLinkReport(
      req.params.shortcode,
      req.query.user_id
    );
    sendSuccess(res, report);
  } catch (err) {
    next(err);
  }
}
